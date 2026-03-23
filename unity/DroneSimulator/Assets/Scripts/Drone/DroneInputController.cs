using UnityEngine;

namespace DroneSimulator
{
    /// <summary>
    /// Simple keyboard input controller for testing the drone.
    /// </summary>
    [RequireComponent(typeof(DroneController))]
    public class DroneInputController : MonoBehaviour
    {
        #region Serialized Fields

        [Header("Control Settings")]
        [SerializeField] private float throttleSpeed = 0.5f;
        [SerializeField] private float rollPitchSpeed = 0.3f;
        [SerializeField] private float yawSpeed = 0.2f;

        [Header("Key Bindings")]
        [SerializeField] private KeyCode throttleUp = KeyCode.Space;
        [SerializeField] private KeyCode throttleDown = KeyCode.LeftShift;
        [SerializeField] private KeyCode resetKey = KeyCode.R;

        #endregion

        #region Private Fields

        private DroneController droneController;
        private float baseThrottle;
        private float[] motorDifferentials;

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            droneController = GetComponent<DroneController>();
            motorDifferentials = new float[4];
        }

        private void Start()
        {
            // Start at hover throttle
            baseThrottle = droneController.GetHoverThrottle();
        }

        private void Update()
        {
            HandleInput();
            ApplyThrottles();

            if (Input.GetKeyDown(resetKey))
            {
                droneController.ResetDrone();
                baseThrottle = droneController.GetHoverThrottle();
            }
        }

        #endregion

        #region Input Handling

        private void HandleInput()
        {
            // Reset differentials
            for (int i = 0; i < 4; i++)
            {
                motorDifferentials[i] = 0;
            }

            // Throttle (collective)
            if (Input.GetKey(throttleUp))
            {
                baseThrottle += throttleSpeed * Time.deltaTime;
            }
            if (Input.GetKey(throttleDown))
            {
                baseThrottle -= throttleSpeed * Time.deltaTime;
            }
            baseThrottle = Mathf.Clamp01(baseThrottle);

            // Roll (A/D) - differential on left/right motors
            // Assuming X configuration: 0=FR, 1=FL, 2=RL, 3=RR
            float rollInput = 0;
            if (Input.GetKey(KeyCode.A)) rollInput = -1;
            if (Input.GetKey(KeyCode.D)) rollInput = 1;

            if (rollInput != 0)
            {
                float rollDiff = rollInput * rollPitchSpeed * Time.deltaTime;
                motorDifferentials[0] += rollDiff;  // Front Right
                motorDifferentials[3] += rollDiff;  // Rear Right
                motorDifferentials[1] -= rollDiff;  // Front Left
                motorDifferentials[2] -= rollDiff;  // Rear Left
            }

            // Pitch (W/S) - differential on front/rear motors
            float pitchInput = 0;
            if (Input.GetKey(KeyCode.W)) pitchInput = 1;
            if (Input.GetKey(KeyCode.S)) pitchInput = -1;

            if (pitchInput != 0)
            {
                float pitchDiff = pitchInput * rollPitchSpeed * Time.deltaTime;
                motorDifferentials[0] -= pitchDiff;  // Front Right
                motorDifferentials[1] -= pitchDiff;  // Front Left
                motorDifferentials[2] += pitchDiff;  // Rear Left
                motorDifferentials[3] += pitchDiff;  // Rear Right
            }

            // Yaw (Q/E) - differential on CW/CCW motors
            float yawInput = 0;
            if (Input.GetKey(KeyCode.Q)) yawInput = -1;
            if (Input.GetKey(KeyCode.E)) yawInput = 1;

            if (yawInput != 0)
            {
                float yawDiff = yawInput * yawSpeed * Time.deltaTime;
                // Assuming 0,2 are CW and 1,3 are CCW
                motorDifferentials[0] += yawDiff;
                motorDifferentials[2] += yawDiff;
                motorDifferentials[1] -= yawDiff;
                motorDifferentials[3] -= yawDiff;
            }
        }

        private void ApplyThrottles()
        {
            float[] throttles = new float[4];

            for (int i = 0; i < 4; i++)
            {
                throttles[i] = Mathf.Clamp01(baseThrottle + motorDifferentials[i]);
            }

            droneController.SetMotorThrottles(throttles);
        }

        #endregion
    }
}

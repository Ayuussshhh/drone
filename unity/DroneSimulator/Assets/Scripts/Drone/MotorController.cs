using UnityEngine;

namespace DroneSimulator
{
    /// <summary>
    /// Controls a single motor on the drone.
    /// Handles thrust calculation, propeller rotation, and reaction torque.
    /// </summary>
    public class MotorController : MonoBehaviour
    {
        #region Serialized Fields

        [Header("Motor Configuration")]
        [SerializeField] private int motorIndex = 0;
        [SerializeField] private float kvRating = 920f;
        [SerializeField] private float maxRPM = 12000f;
        [SerializeField] private float minRPM = 1000f;
        [SerializeField] private float thrustConstant = 1.5e-5f;

        [Header("Rotation")]
        [SerializeField] private RotationDirection rotationDirection = RotationDirection.Clockwise;
        [SerializeField] private float torqueCoefficient = 0.01f;

        [Header("Visual")]
        [SerializeField] private Transform propellerTransform;
        [SerializeField] private float visualSpeedMultiplier = 10f;
        [SerializeField] private bool blurAtHighSpeed = true;
        [SerializeField] private Material normalPropMaterial;
        [SerializeField] private Material blurredPropMaterial;

        [Header("Audio")]
        [SerializeField] private AudioSource motorSound;
        [SerializeField] private float minPitch = 0.5f;
        [SerializeField] private float maxPitch = 2.0f;

        #endregion

        #region Private Fields

        private DroneController droneController;
        private MeshRenderer propellerRenderer;
        private float currentRPM;
        private float currentThrottle;
        private float targetRPM;

        // Smoothing
        private float rpmVelocity;
        private const float RPM_SMOOTH_TIME = 0.1f;

        #endregion

        #region Properties

        public int MotorIndex => motorIndex;
        public float CurrentRPM => currentRPM;
        public float CurrentThrottle => currentThrottle;
        public RotationDirection Direction => rotationDirection;

        #endregion

        #region Initialization

        private void Awake()
        {
            // Get propeller renderer
            if (propellerTransform != null)
            {
                propellerRenderer = propellerTransform.GetComponent<MeshRenderer>();
            }
        }

        /// <summary>
        /// Initialize the motor with parent drone controller.
        /// </summary>
        public void Initialize(DroneController controller, int index)
        {
            droneController = controller;
            motorIndex = index;

            Debug.Log($"Motor {index} initialized: {rotationDirection}");
        }

        #endregion

        #region Motor Physics

        /// <summary>
        /// Calculate thrust at current throttle setting.
        /// Uses the formula: T = k_t * omega^2
        /// </summary>
        public float CalculateThrust(float throttle)
        {
            throttle = Mathf.Clamp01(throttle);

            // Calculate RPM from throttle
            float rpm = minRPM + throttle * (maxRPM - minRPM);

            // Convert to rad/s
            float omega = rpm * 2f * Mathf.PI / 60f;

            // Calculate thrust
            // In reality, this depends on propeller characteristics
            // T = k_t * omega^2
            float thrust = thrustConstant * omega * omega;

            return thrust;
        }

        /// <summary>
        /// Get reaction torque from motor spin.
        /// This is what causes yaw rotation in multirotors.
        /// </summary>
        public float GetReactionTorque(float throttle)
        {
            float thrust = CalculateThrust(throttle);

            // Torque is proportional to thrust, direction depends on spin direction
            float torque = thrust * torqueCoefficient;

            // Sign based on rotation direction
            return rotationDirection == RotationDirection.Clockwise ? torque : -torque;
        }

        /// <summary>
        /// Get angular momentum contribution for gyroscopic effects.
        /// </summary>
        public Vector3 GetAngularMomentum()
        {
            // Simplified moment of inertia for propeller
            float propellerInertia = 0.0001f; // kg*m^2

            float omega = currentRPM * 2f * Mathf.PI / 60f;

            float direction = rotationDirection == RotationDirection.Clockwise ? 1f : -1f;

            return transform.up * propellerInertia * omega * direction;
        }

        #endregion

        #region Update

        /// <summary>
        /// Update motor state (called by DroneController).
        /// </summary>
        public void UpdateMotor(float throttle)
        {
            currentThrottle = Mathf.Clamp01(throttle);

            // Calculate target RPM
            targetRPM = minRPM + currentThrottle * (maxRPM - minRPM);

            // Smooth RPM transition (motor spin-up time)
            currentRPM = Mathf.SmoothDamp(currentRPM, targetRPM, ref rpmVelocity, RPM_SMOOTH_TIME);

            // Update visuals
            UpdatePropellerVisual();

            // Update audio
            UpdateMotorAudio();
        }

        private void UpdatePropellerVisual()
        {
            if (propellerTransform == null) return;

            // Calculate rotation speed
            float rotationSpeed = currentRPM / 60f * 360f * visualSpeedMultiplier * Time.deltaTime;

            // Apply direction
            if (rotationDirection == RotationDirection.CounterClockwise)
            {
                rotationSpeed = -rotationSpeed;
            }

            // Rotate propeller
            propellerTransform.Rotate(Vector3.up, rotationSpeed, Space.Self);

            // Handle blur material swap at high speeds
            if (blurAtHighSpeed && propellerRenderer != null)
            {
                float blurThreshold = maxRPM * 0.3f;

                if (currentRPM > blurThreshold && blurredPropMaterial != null)
                {
                    if (propellerRenderer.material != blurredPropMaterial)
                    {
                        propellerRenderer.material = blurredPropMaterial;
                    }
                }
                else if (normalPropMaterial != null)
                {
                    if (propellerRenderer.material != normalPropMaterial)
                    {
                        propellerRenderer.material = normalPropMaterial;
                    }
                }
            }
        }

        private void UpdateMotorAudio()
        {
            if (motorSound == null) return;

            // Calculate pitch based on RPM
            float rpmNormalized = (currentRPM - minRPM) / (maxRPM - minRPM);
            motorSound.pitch = Mathf.Lerp(minPitch, maxPitch, rpmNormalized);

            // Volume based on throttle
            motorSound.volume = Mathf.Lerp(0.1f, 1f, currentThrottle);

            // Start/stop sound
            if (currentThrottle > 0.01f && !motorSound.isPlaying)
            {
                motorSound.Play();
            }
            else if (currentThrottle <= 0.01f && motorSound.isPlaying)
            {
                motorSound.Stop();
            }
        }

        #endregion

        #region Utility

        /// <summary>
        /// Get estimated power consumption at current throttle.
        /// </summary>
        public float GetPowerConsumption()
        {
            // Simplified power model: P = k * RPM^3 (for propeller load)
            float powerCoefficient = 1e-10f;
            return powerCoefficient * Mathf.Pow(currentRPM, 3);
        }

        /// <summary>
        /// Get motor efficiency at current operating point.
        /// </summary>
        public float GetEfficiency()
        {
            // Peak efficiency typically around 70-80% throttle
            float optimalThrottle = 0.75f;
            float deviation = Mathf.Abs(currentThrottle - optimalThrottle);

            // Efficiency curve (simplified)
            return 0.85f - deviation * 0.3f;
        }

        #endregion

        #region Debug

        private void OnDrawGizmosSelected()
        {
            // Draw motor axis
            Gizmos.color = Color.blue;
            Gizmos.DrawRay(transform.position, transform.up * 0.1f);

            // Draw rotation direction
            Gizmos.color = rotationDirection == RotationDirection.Clockwise ? Color.green : Color.red;
            Vector3 arcStart = transform.position + transform.right * 0.05f;
            Vector3 arcEnd = transform.position + transform.forward * 0.05f;
            Gizmos.DrawLine(arcStart, transform.position + transform.up * 0.02f);
            Gizmos.DrawLine(transform.position + transform.up * 0.02f, arcEnd);
        }

        #endregion
    }

    /// <summary>
    /// Motor rotation direction.
    /// </summary>
    public enum RotationDirection
    {
        Clockwise = 1,
        CounterClockwise = -1
    }
}

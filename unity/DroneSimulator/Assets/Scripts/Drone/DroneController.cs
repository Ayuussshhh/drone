using UnityEngine;
using System;
using System.Collections.Generic;

namespace DroneSimulator
{
    /// <summary>
    /// Main drone controller that orchestrates all drone subsystems.
    /// Manages motors, physics, stability, and network synchronization.
    /// </summary>
    [RequireComponent(typeof(Rigidbody))]
    public class DroneController : MonoBehaviour
    {
        #region Serialized Fields

        [Header("Drone Configuration")]
        [SerializeField] private string droneId = "drone_1";
        [SerializeField] private float totalMass = 1.5f;
        [SerializeField] private float armLength = 0.225f;

        [Header("Motor Configuration")]
        [SerializeField] private MotorController[] motors;
        [SerializeField] private float maxThrustPerMotor = 10f;

        [Header("Physics Settings")]
        [SerializeField] private float dragCoefficient = 1.0f;
        [SerializeField] private float frontalArea = 0.04f;

        [Header("Control Settings")]
        [SerializeField] private bool useAutoStabilization = true;
        [SerializeField] private float stabilizationStrength = 5f;
        [SerializeField] private float maxTiltAngle = 45f;

        [Header("References")]
        [SerializeField] private TetherController tetherController;
        [SerializeField] private WindSimulator windSimulator;
        [SerializeField] private StabilitySystem stabilitySystem;

        [Header("Debug")]
        [SerializeField] private bool showForceGizmos = true;
        [SerializeField] private bool showDebugInfo = true;

        #endregion

        #region Private Fields

        private Rigidbody rb;
        private Vector3 netForce;
        private Vector3 netTorque;
        private float[] motorThrottles;
        private float[] motorThrusts;
        private DroneState currentState;

        // Network sync
        private SimulationSync networkSync;
        private bool isNetworkControlled = false;

        // Physics constants
        private const float AIR_DENSITY = 1.225f;
        private const float GRAVITY = 9.81f;

        #endregion

        #region Properties

        public string DroneId => droneId;
        public float TotalMass => totalMass;
        public float[] MotorThrottles => motorThrottles;
        public float[] MotorThrusts => motorThrusts;
        public DroneState CurrentState => currentState;
        public Rigidbody Rigidbody => rb;

        public float ThrustToWeightRatio
        {
            get
            {
                float maxThrust = motors.Length * maxThrustPerMotor;
                float weight = totalMass * GRAVITY;
                return weight > 0 ? maxThrust / weight : 0;
            }
        }

        #endregion

        #region Events

        public event Action<DroneState> OnStateUpdated;
        public event Action<string> OnStatusChanged;

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            rb = GetComponent<Rigidbody>();
            ConfigureRigidbody();

            // Initialize arrays
            if (motors != null && motors.Length > 0)
            {
                motorThrottles = new float[motors.Length];
                motorThrusts = new float[motors.Length];
            }
            else
            {
                Debug.LogWarning("No motors assigned to DroneController!");
                motorThrottles = new float[4];
                motorThrusts = new float[4];
            }

            // Initialize state
            currentState = new DroneState();

            // Get network sync if available
            networkSync = GetComponent<SimulationSync>();
        }

        private void Start()
        {
            // Auto-find components if not assigned
            if (tetherController == null)
                tetherController = GetComponentInChildren<TetherController>();

            if (windSimulator == null)
                windSimulator = FindObjectOfType<WindSimulator>();

            if (stabilitySystem == null)
                stabilitySystem = GetComponent<StabilitySystem>();

            // Initialize motors
            InitializeMotors();
        }

        private void FixedUpdate()
        {
            // Clear forces for this frame
            netForce = Vector3.zero;
            netTorque = Vector3.zero;

            // Calculate all forces
            CalculateMotorForces();
            CalculateGravity();
            CalculateDrag();
            CalculateWindForce();
            CalculateTetherForce();

            // Apply stabilization if enabled
            if (useAutoStabilization && !isNetworkControlled)
            {
                ApplyStabilization();
            }

            // Apply net force and torque
            rb.AddForce(netForce, ForceMode.Force);
            rb.AddTorque(netTorque, ForceMode.Force);

            // Update state
            UpdateDroneState();

            // Notify listeners
            OnStateUpdated?.Invoke(currentState);
        }

        #endregion

        #region Configuration

        private void ConfigureRigidbody()
        {
            rb.mass = totalMass;
            rb.drag = 0; // We handle drag manually
            rb.angularDrag = 0.5f;
            rb.useGravity = false; // We handle gravity manually
            rb.interpolation = RigidbodyInterpolation.Interpolate;
            rb.collisionDetectionMode = CollisionDetectionMode.Continuous;
        }

        private void InitializeMotors()
        {
            if (motors == null || motors.Length == 0)
            {
                // Auto-find motors
                motors = GetComponentsInChildren<MotorController>();
            }

            // Configure each motor
            for (int i = 0; i < motors.Length; i++)
            {
                if (motors[i] != null)
                {
                    motors[i].Initialize(this, i);
                }
            }

            Debug.Log($"DroneController initialized with {motors.Length} motors");
        }

        #endregion

        #region Motor Control

        /// <summary>
        /// Set throttle for all motors uniformly.
        /// </summary>
        public void SetThrottle(float throttle)
        {
            throttle = Mathf.Clamp01(throttle);
            for (int i = 0; i < motorThrottles.Length; i++)
            {
                motorThrottles[i] = throttle;
            }
        }

        /// <summary>
        /// Set throttle for individual motors.
        /// </summary>
        public void SetMotorThrottles(float[] throttles)
        {
            if (throttles == null || throttles.Length != motorThrottles.Length)
            {
                Debug.LogWarning("Invalid throttle array length");
                return;
            }

            for (int i = 0; i < motorThrottles.Length; i++)
            {
                motorThrottles[i] = Mathf.Clamp01(throttles[i]);
            }
        }

        /// <summary>
        /// Set throttle for a specific motor.
        /// </summary>
        public void SetMotorThrottle(int motorIndex, float throttle)
        {
            if (motorIndex >= 0 && motorIndex < motorThrottles.Length)
            {
                motorThrottles[motorIndex] = Mathf.Clamp01(throttle);
            }
        }

        /// <summary>
        /// Calculate hover throttle based on current configuration.
        /// </summary>
        public float GetHoverThrottle()
        {
            float weight = totalMass * GRAVITY;
            float maxThrust = motors.Length * maxThrustPerMotor;

            if (maxThrust <= 0) return 1f;

            // Throttle for hover (assuming quadratic thrust curve)
            float ratio = weight / maxThrust;
            return Mathf.Sqrt(ratio);
        }

        #endregion

        #region Force Calculations

        private void CalculateMotorForces()
        {
            for (int i = 0; i < motors.Length; i++)
            {
                if (motors[i] == null) continue;

                float throttle = motorThrottles[i];

                // Calculate thrust (quadratic relationship with throttle)
                float thrust = maxThrustPerMotor * throttle * throttle;
                motorThrusts[i] = thrust;

                // Get thrust direction (local up, transformed to world)
                Vector3 thrustDirection = motors[i].transform.up;
                Vector3 thrustForce = thrustDirection * thrust;

                // Apply thrust force
                netForce += thrustForce;

                // Calculate torque from motor position
                Vector3 motorOffset = motors[i].transform.position - rb.worldCenterOfMass;
                Vector3 motorTorque = Vector3.Cross(motorOffset, thrustForce);
                netTorque += motorTorque;

                // Add reaction torque from motor spin
                float reactionTorque = motors[i].GetReactionTorque(throttle);
                netTorque += transform.up * reactionTorque;

                // Update motor visuals
                motors[i].UpdateMotor(throttle);
            }
        }

        private void CalculateGravity()
        {
            Vector3 gravityForce = Vector3.down * totalMass * GRAVITY;
            netForce += gravityForce;
        }

        private void CalculateDrag()
        {
            Vector3 velocity = rb.velocity;
            float speed = velocity.magnitude;

            if (speed < 0.01f) return;

            // F_drag = 0.5 * rho * v^2 * Cd * A
            float dragMagnitude = 0.5f * AIR_DENSITY * speed * speed * dragCoefficient * frontalArea;
            Vector3 dragForce = -velocity.normalized * dragMagnitude;

            netForce += dragForce;
        }

        private void CalculateWindForce()
        {
            if (windSimulator == null) return;

            Vector3 windForce = windSimulator.GetWindForce(transform.position, frontalArea, dragCoefficient);
            netForce += windForce;
        }

        private void CalculateTetherForce()
        {
            if (tetherController == null || !tetherController.IsEnabled) return;

            Vector3 tetherForce = tetherController.GetTetherForce(transform.position, rb.velocity);
            netForce += tetherForce;

            // Tether torque (if attached off-center)
            Vector3 attachmentOffset = tetherController.GetAttachmentOffset();
            if (attachmentOffset.magnitude > 0.01f)
            {
                Vector3 tetherTorque = Vector3.Cross(attachmentOffset, tetherForce);
                netTorque += tetherTorque;
            }
        }

        #endregion

        #region Stabilization

        private void ApplyStabilization()
        {
            // Get current rotation
            Vector3 currentEuler = transform.eulerAngles;

            // Normalize angles to -180 to 180
            float roll = NormalizeAngle(currentEuler.z);
            float pitch = NormalizeAngle(currentEuler.x);

            // Calculate correction torques
            Vector3 angularVelocity = rb.angularVelocity;

            // PD controller for stabilization
            float rollCorrection = -roll * stabilizationStrength - angularVelocity.z * (stabilizationStrength * 0.5f);
            float pitchCorrection = -pitch * stabilizationStrength - angularVelocity.x * (stabilizationStrength * 0.5f);

            // Apply corrections
            netTorque += new Vector3(pitchCorrection, 0, rollCorrection);
        }

        private float NormalizeAngle(float angle)
        {
            while (angle > 180f) angle -= 360f;
            while (angle < -180f) angle += 360f;
            return angle;
        }

        #endregion

        #region State Management

        private void UpdateDroneState()
        {
            currentState.timestamp = Time.time;
            currentState.position = transform.position;
            currentState.velocity = rb.velocity;
            currentState.acceleration = netForce / totalMass;
            currentState.rotation = transform.eulerAngles;
            currentState.angularVelocity = rb.angularVelocity;
            currentState.netForce = netForce;
            currentState.netTorque = netTorque;
            currentState.motorThrusts = (float[])motorThrusts.Clone();
            currentState.altitude = transform.position.y;
            currentState.groundSpeed = new Vector3(rb.velocity.x, 0, rb.velocity.z).magnitude;
            currentState.airSpeed = rb.velocity.magnitude;

            // Tether state
            if (tetherController != null && tetherController.IsEnabled)
            {
                currentState.tetherTension = tetherController.CurrentTension;
                currentState.tetherAngle = tetherController.AngleFromVertical;
            }

            // Flight status
            currentState.flightStatus = DetermineFlightStatus();

            // Stability
            if (stabilitySystem != null)
            {
                currentState.stabilityScore = stabilitySystem.GetStabilityScore();
            }
        }

        private FlightStatus DetermineFlightStatus()
        {
            // Check ground contact
            if (transform.position.y < 0.1f)
            {
                if (rb.velocity.magnitude < 0.1f)
                    return FlightStatus.Grounded;
                else
                    return FlightStatus.Crashed;
            }

            // Check tilt angle
            float tilt = GetTiltAngle();
            if (tilt > maxTiltAngle)
            {
                return FlightStatus.Unstable;
            }

            // Check if hovering or moving
            if (rb.velocity.magnitude < 0.5f)
            {
                return FlightStatus.Hovering;
            }

            return FlightStatus.Flying;
        }

        public float GetTiltAngle()
        {
            Vector3 up = transform.up;
            float dotProduct = Vector3.Dot(up, Vector3.up);
            return Mathf.Acos(Mathf.Clamp(dotProduct, -1f, 1f)) * Mathf.Rad2Deg;
        }

        #endregion

        #region Network Control

        /// <summary>
        /// Apply state received from network (backend simulation).
        /// </summary>
        public void ApplyNetworkState(DroneState state)
        {
            isNetworkControlled = true;

            // Interpolate to received state
            transform.position = Vector3.Lerp(transform.position, state.position, 0.5f);
            rb.velocity = Vector3.Lerp(rb.velocity, state.velocity, 0.5f);

            // Apply rotation
            Quaternion targetRotation = Quaternion.Euler(state.rotation);
            transform.rotation = Quaternion.Slerp(transform.rotation, targetRotation, 0.5f);
            rb.angularVelocity = Vector3.Lerp(rb.angularVelocity, state.angularVelocity, 0.5f);

            // Update motor throttles from thrust values
            if (state.motorThrusts != null)
            {
                for (int i = 0; i < state.motorThrusts.Length && i < motorThrottles.Length; i++)
                {
                    // Reverse calculate throttle from thrust
                    float thrust = state.motorThrusts[i];
                    motorThrottles[i] = Mathf.Sqrt(thrust / maxThrustPerMotor);
                }
            }

            currentState = state;
        }

        /// <summary>
        /// Switch between local and network-controlled physics.
        /// </summary>
        public void SetNetworkControlled(bool controlled)
        {
            isNetworkControlled = controlled;
        }

        #endregion

        #region Public Methods

        /// <summary>
        /// Reset drone to initial state.
        /// </summary>
        public void ResetDrone()
        {
            transform.position = new Vector3(0, 2, 0);
            transform.rotation = Quaternion.identity;
            rb.velocity = Vector3.zero;
            rb.angularVelocity = Vector3.zero;

            SetThrottle(0);

            OnStatusChanged?.Invoke("Reset");
        }

        /// <summary>
        /// Emergency stop - cut all motors.
        /// </summary>
        public void EmergencyStop()
        {
            SetThrottle(0);
            OnStatusChanged?.Invoke("Emergency Stop");
        }

        /// <summary>
        /// Get drone configuration as a dictionary for network sync.
        /// </summary>
        public Dictionary<string, object> GetConfiguration()
        {
            return new Dictionary<string, object>
            {
                { "id", droneId },
                { "totalMass", totalMass },
                { "armLength", armLength },
                { "motorCount", motors.Length },
                { "maxThrustPerMotor", maxThrustPerMotor },
                { "dragCoefficient", dragCoefficient },
                { "frontalArea", frontalArea }
            };
        }

        #endregion

        #region Debug Visualization

        private void OnDrawGizmos()
        {
            if (!showForceGizmos || !Application.isPlaying) return;

            // Draw net force
            Gizmos.color = Color.yellow;
            Gizmos.DrawRay(transform.position, netForce * 0.1f);

            // Draw velocity
            if (rb != null)
            {
                Gizmos.color = Color.cyan;
                Gizmos.DrawRay(transform.position, rb.velocity);
            }

            // Draw motor thrusts
            if (motors != null)
            {
                Gizmos.color = Color.green;
                for (int i = 0; i < motors.Length; i++)
                {
                    if (motors[i] != null)
                    {
                        Vector3 thrustDir = motors[i].transform.up * motorThrusts[i] * 0.1f;
                        Gizmos.DrawRay(motors[i].transform.position, thrustDir);
                    }
                }
            }

            // Draw center of mass
            Gizmos.color = Color.red;
            Gizmos.DrawWireSphere(rb?.worldCenterOfMass ?? transform.position, 0.05f);
        }

        private void OnGUI()
        {
            if (!showDebugInfo) return;

            GUILayout.BeginArea(new Rect(10, 10, 300, 400));
            GUILayout.BeginVertical("box");

            GUILayout.Label($"=== {droneId} Debug ===");
            GUILayout.Label($"Status: {currentState.flightStatus}");
            GUILayout.Label($"Altitude: {currentState.altitude:F2} m");
            GUILayout.Label($"Speed: {currentState.airSpeed:F2} m/s");
            GUILayout.Label($"Tilt: {GetTiltAngle():F1}°");
            GUILayout.Label($"T/W Ratio: {ThrustToWeightRatio:F2}");

            if (stabilitySystem != null)
            {
                GUILayout.Label($"Stability: {currentState.stabilityScore:F0}%");
            }

            if (tetherController != null && tetherController.IsEnabled)
            {
                GUILayout.Label($"Tether: {currentState.tetherTension:F1} N");
            }

            GUILayout.EndVertical();
            GUILayout.EndArea();
        }

        #endregion
    }

    #region Supporting Types

    /// <summary>
    /// Drone state snapshot for network sync and analysis.
    /// </summary>
    [Serializable]
    public class DroneState
    {
        public float timestamp;
        public Vector3 position;
        public Vector3 velocity;
        public Vector3 acceleration;
        public Vector3 rotation;
        public Vector3 angularVelocity;
        public Vector3 netForce;
        public Vector3 netTorque;
        public float[] motorThrusts;
        public float altitude;
        public float groundSpeed;
        public float airSpeed;
        public float tetherTension;
        public float tetherAngle;
        public float stabilityScore;
        public FlightStatus flightStatus;
    }

    /// <summary>
    /// Flight status enumeration.
    /// </summary>
    public enum FlightStatus
    {
        Grounded,
        Flying,
        Hovering,
        Unstable,
        Crashed
    }

    #endregion
}

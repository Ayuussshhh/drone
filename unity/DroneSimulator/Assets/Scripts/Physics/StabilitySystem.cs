using UnityEngine;
using System.Collections.Generic;

namespace DroneSimulator
{
    /// <summary>
    /// Real-time stability analysis system for the drone.
    /// Calculates stability score, detects oscillations, and provides control authority metrics.
    /// </summary>
    [RequireComponent(typeof(DroneController))]
    public class StabilitySystem : MonoBehaviour
    {
        #region Serialized Fields

        [Header("Thresholds")]
        [SerializeField] private float maxSafeTilt = 45f;
        [SerializeField] private float criticalTilt = 60f;
        [SerializeField] private float maxTorqueImbalance = 1f;
        [SerializeField] private float oscillationThreshold = 5f;

        [Header("Analysis")]
        [SerializeField] private int historySize = 100;
        [SerializeField] private bool enableOscillationDetection = true;

        [Header("Debug")]
        [SerializeField] private bool showStabilityGizmos = true;

        #endregion

        #region Private Fields

        private DroneController droneController;
        private Rigidbody rb;

        // History buffers for oscillation detection
        private Queue<float> rollHistory;
        private Queue<float> pitchHistory;
        private Queue<float> yawHistory;
        private Queue<float> timeHistory;

        // Stability metrics
        private float stabilityScore;
        private string stabilityClass;
        private float currentTilt;
        private Vector3 comPosition;
        private float torqueImbalance;
        private OscillationInfo oscillationInfo;
        private ControlAuthority controlAuthority;

        // Warnings
        private List<string> warnings;
        private List<string> criticalIssues;

        #endregion

        #region Properties

        public float StabilityScore => stabilityScore;
        public string StabilityClass => stabilityClass;
        public float CurrentTilt => currentTilt;
        public OscillationInfo Oscillation => oscillationInfo;
        public ControlAuthority Authority => controlAuthority;
        public List<string> Warnings => warnings;
        public List<string> CriticalIssues => criticalIssues;

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            droneController = GetComponent<DroneController>();
            rb = GetComponent<Rigidbody>();

            // Initialize buffers
            rollHistory = new Queue<float>(historySize);
            pitchHistory = new Queue<float>(historySize);
            yawHistory = new Queue<float>(historySize);
            timeHistory = new Queue<float>(historySize);

            warnings = new List<string>();
            criticalIssues = new List<string>();
            oscillationInfo = new OscillationInfo();
            controlAuthority = new ControlAuthority();
        }

        private void FixedUpdate()
        {
            UpdateHistory();
            AnalyzeStability();
        }

        #endregion

        #region Analysis

        private void UpdateHistory()
        {
            Vector3 rotation = transform.eulerAngles;

            // Normalize angles
            float roll = NormalizeAngle(rotation.z);
            float pitch = NormalizeAngle(rotation.x);
            float yaw = NormalizeAngle(rotation.y);

            // Add to history
            AddToHistory(rollHistory, roll);
            AddToHistory(pitchHistory, pitch);
            AddToHistory(yawHistory, yaw);
            AddToHistory(timeHistory, Time.time);
        }

        private void AddToHistory(Queue<float> queue, float value)
        {
            if (queue.Count >= historySize)
            {
                queue.Dequeue();
            }
            queue.Enqueue(value);
        }

        private void AnalyzeStability()
        {
            warnings.Clear();
            criticalIssues.Clear();

            // Calculate tilt angle
            CalculateTilt();

            // Calculate center of mass
            CalculateCenterOfMass();

            // Calculate torque imbalance
            CalculateTorqueImbalance();

            // Detect oscillations
            if (enableOscillationDetection)
            {
                DetectOscillations();
            }

            // Calculate control authority
            CalculateControlAuthority();

            // Generate warnings
            GenerateWarnings();

            // Calculate overall stability score
            CalculateStabilityScore();

            // Classify stability
            ClassifyStability();
        }

        private void CalculateTilt()
        {
            Vector3 up = transform.up;
            float dotProduct = Vector3.Dot(up, Vector3.up);
            currentTilt = Mathf.Acos(Mathf.Clamp(dotProduct, -1f, 1f)) * Mathf.Rad2Deg;
        }

        private void CalculateCenterOfMass()
        {
            if (rb != null)
            {
                comPosition = rb.worldCenterOfMass - transform.position;
            }
        }

        private void CalculateTorqueImbalance()
        {
            if (droneController.CurrentState != null)
            {
                torqueImbalance = droneController.CurrentState.netTorque.magnitude;
            }
        }

        private void DetectOscillations()
        {
            if (rollHistory.Count < 20)
            {
                oscillationInfo.isOscillating = false;
                return;
            }

            float[] rollArray = rollHistory.ToArray();
            float[] pitchArray = pitchHistory.ToArray();

            // Calculate amplitude
            float rollAmp = (MaxOf(rollArray) - MinOf(rollArray)) / 2f;
            float pitchAmp = (MaxOf(pitchArray) - MinOf(pitchArray)) / 2f;
            float maxAmp = Mathf.Max(rollAmp, pitchAmp);

            if (maxAmp < oscillationThreshold)
            {
                oscillationInfo.isOscillating = false;
                oscillationInfo.amplitude = 0;
                oscillationInfo.frequency = 0;
                return;
            }

            oscillationInfo.isOscillating = true;
            oscillationInfo.amplitude = maxAmp;
            oscillationInfo.axis = rollAmp > pitchAmp ? "roll" : "pitch";

            // Estimate frequency using zero crossings
            float[] data = rollAmp > pitchAmp ? rollArray : pitchArray;
            float mean = AverageOf(data);
            int zeroCrossings = CountZeroCrossings(data, mean);

            float[] times = timeHistory.ToArray();
            float timeSpan = times[times.Length - 1] - times[0];

            if (timeSpan > 0 && zeroCrossings > 0)
            {
                oscillationInfo.frequency = zeroCrossings / (2f * timeSpan);
            }
        }

        private void CalculateControlAuthority()
        {
            float twr = droneController.ThrustToWeightRatio;

            // Altitude authority
            controlAuthority.altitude = Mathf.Clamp((twr - 1f) * 100f, 0f, 100f);

            // Base authority from TWR
            float baseAuthority = Mathf.Clamp(twr * 50f, 0f, 100f);

            // Reduce authority based on tilt
            float tiltFactor = Mathf.Max(0, 1f - currentTilt / criticalTilt);

            controlAuthority.roll = baseAuthority * tiltFactor;
            controlAuthority.pitch = baseAuthority * tiltFactor;
            controlAuthority.yaw = baseAuthority * 0.8f; // Typically less than roll/pitch
        }

        private void GenerateWarnings()
        {
            // Tilt warnings
            if (currentTilt > maxSafeTilt)
            {
                criticalIssues.Add($"Tilt angle ({currentTilt:F1}°) exceeds safe limit");
            }
            else if (currentTilt > maxSafeTilt * 0.7f)
            {
                warnings.Add($"Tilt angle ({currentTilt:F1}°) approaching limit");
            }

            // TWR warnings
            float twr = droneController.ThrustToWeightRatio;
            if (twr < 1f)
            {
                criticalIssues.Add($"Insufficient thrust (T/W = {twr:F2})");
            }
            else if (twr < 1.2f)
            {
                warnings.Add($"Low thrust margin (T/W = {twr:F2})");
            }

            // Torque imbalance
            if (torqueImbalance > maxTorqueImbalance * 2)
            {
                criticalIssues.Add($"Severe torque imbalance ({torqueImbalance:F2} N·m)");
            }
            else if (torqueImbalance > maxTorqueImbalance)
            {
                warnings.Add($"Torque imbalance ({torqueImbalance:F2} N·m)");
            }

            // Oscillation
            if (oscillationInfo.isOscillating)
            {
                if (oscillationInfo.amplitude > oscillationThreshold * 2)
                {
                    criticalIssues.Add($"Severe {oscillationInfo.axis} oscillation ({oscillationInfo.amplitude:F1}°)");
                }
                else
                {
                    warnings.Add($"{oscillationInfo.axis} oscillation detected ({oscillationInfo.amplitude:F1}°)");
                }
            }

            // Altitude
            if (transform.position.y < 0.5f)
            {
                warnings.Add("Low altitude - ground proximity");
            }
            if (transform.position.y < 0)
            {
                criticalIssues.Add("Below ground level");
            }
        }

        private void CalculateStabilityScore()
        {
            stabilityScore = 100f;

            // Tilt penalty (max 40)
            float tiltRatio = currentTilt / maxSafeTilt;
            stabilityScore -= Mathf.Min(40f, tiltRatio * 40f);

            // Torque penalty (max 20)
            float torqueRatio = torqueImbalance / maxTorqueImbalance;
            stabilityScore -= Mathf.Min(20f, torqueRatio * 10f);

            // Oscillation penalty (max 20)
            if (oscillationInfo.isOscillating)
            {
                float oscSeverity = oscillationInfo.amplitude / oscillationThreshold;
                stabilityScore -= Mathf.Min(20f, oscSeverity * 10f);
            }

            // Control authority bonus/penalty (±10)
            float avgAuthority = (controlAuthority.roll + controlAuthority.pitch + controlAuthority.altitude) / 3f;
            stabilityScore += (avgAuthority - 50f) / 5f;

            // CoM offset penalty (max 10)
            float comOffset = comPosition.magnitude;
            stabilityScore -= Mathf.Min(10f, comOffset * 100f);

            // TWR bonus
            if (droneController.ThrustToWeightRatio > 2f)
            {
                stabilityScore += 5f;
            }

            stabilityScore = Mathf.Clamp(stabilityScore, 0f, 100f);
        }

        private void ClassifyStability()
        {
            if (criticalIssues.Count > 0)
            {
                stabilityClass = "critical";
            }
            else if (stabilityScore >= 80f)
            {
                stabilityClass = "stable";
            }
            else if (stabilityScore >= 50f)
            {
                stabilityClass = "marginal";
            }
            else
            {
                stabilityClass = "unstable";
            }
        }

        #endregion

        #region Public Methods

        /// <summary>
        /// Get current stability score.
        /// </summary>
        public float GetStabilityScore()
        {
            return stabilityScore;
        }

        /// <summary>
        /// Get complete stability report.
        /// </summary>
        public StabilityReport GetReport()
        {
            return new StabilityReport
            {
                stabilityScore = stabilityScore,
                stabilityClass = stabilityClass,
                currentTilt = currentTilt,
                maxSafeTilt = maxSafeTilt,
                tiltMargin = maxSafeTilt - currentTilt,
                comPosition = comPosition,
                comOffset = comPosition.magnitude,
                torqueImbalance = torqueImbalance,
                oscillation = oscillationInfo,
                controlAuthority = controlAuthority,
                warnings = new List<string>(warnings),
                criticalIssues = new List<string>(criticalIssues)
            };
        }

        /// <summary>
        /// Check if drone can fly with current configuration.
        /// </summary>
        public bool CanFly(out string reason)
        {
            float twr = droneController.ThrustToWeightRatio;

            if (twr < 1f)
            {
                reason = $"Insufficient thrust (T/W = {twr:F2})";
                return false;
            }

            reason = $"Flight capable (T/W = {twr:F2})";
            return true;
        }

        /// <summary>
        /// Reset stability analysis.
        /// </summary>
        public void Reset()
        {
            rollHistory.Clear();
            pitchHistory.Clear();
            yawHistory.Clear();
            timeHistory.Clear();
            warnings.Clear();
            criticalIssues.Clear();
        }

        #endregion

        #region Utility

        private float NormalizeAngle(float angle)
        {
            while (angle > 180f) angle -= 360f;
            while (angle < -180f) angle += 360f;
            return angle;
        }

        private float MaxOf(float[] array)
        {
            float max = float.MinValue;
            foreach (float v in array)
            {
                if (v > max) max = v;
            }
            return max;
        }

        private float MinOf(float[] array)
        {
            float min = float.MaxValue;
            foreach (float v in array)
            {
                if (v < min) min = v;
            }
            return min;
        }

        private float AverageOf(float[] array)
        {
            float sum = 0;
            foreach (float v in array) sum += v;
            return sum / array.Length;
        }

        private int CountZeroCrossings(float[] data, float mean)
        {
            int crossings = 0;
            for (int i = 1; i < data.Length; i++)
            {
                if ((data[i - 1] - mean) * (data[i] - mean) < 0)
                {
                    crossings++;
                }
            }
            return crossings;
        }

        #endregion

        #region Debug

        private void OnDrawGizmos()
        {
            if (!showStabilityGizmos || !Application.isPlaying) return;

            // Draw stability indicator
            Color color;
            switch (stabilityClass)
            {
                case "stable":
                    color = Color.green;
                    break;
                case "marginal":
                    color = Color.yellow;
                    break;
                case "unstable":
                    color = new Color(1f, 0.5f, 0f); // Orange
                    break;
                default:
                    color = Color.red;
                    break;
            }

            Gizmos.color = color;
            Gizmos.DrawWireSphere(transform.position + Vector3.up * 0.5f, 0.1f);

            // Draw tilt indicator
            Gizmos.color = Color.blue;
            Gizmos.DrawRay(transform.position, transform.up * 0.5f);

            Gizmos.color = Color.white;
            Gizmos.DrawRay(transform.position, Vector3.up * 0.5f);
        }

        #endregion
    }

    #region Data Structures

    [System.Serializable]
    public class OscillationInfo
    {
        public bool isOscillating;
        public float amplitude;
        public float frequency;
        public string axis;
    }

    [System.Serializable]
    public class ControlAuthority
    {
        public float roll;
        public float pitch;
        public float yaw;
        public float altitude;
    }

    [System.Serializable]
    public class StabilityReport
    {
        public float stabilityScore;
        public string stabilityClass;
        public float currentTilt;
        public float maxSafeTilt;
        public float tiltMargin;
        public Vector3 comPosition;
        public float comOffset;
        public float torqueImbalance;
        public OscillationInfo oscillation;
        public ControlAuthority controlAuthority;
        public List<string> warnings;
        public List<string> criticalIssues;
    }

    #endregion
}

using UnityEngine;

namespace DroneSimulator
{
    /// <summary>
    /// Simulates wind forces with turbulence using Perlin noise.
    /// Provides realistic environmental wind effects for drone simulation.
    /// </summary>
    public class WindSimulator : MonoBehaviour
    {
        #region Serialized Fields

        [Header("Base Wind")]
        [SerializeField] private Vector3 baseWindVelocity = Vector3.zero;
        [SerializeField] private float baseWindSpeed = 0f;
        [SerializeField] private float windDirection = 0f; // Degrees from North

        [Header("Turbulence")]
        [SerializeField] private bool enableTurbulence = true;
        [SerializeField] [Range(0f, 1f)] private float turbulenceIntensity = 0.2f;
        [SerializeField] private float turbulenceFrequency = 0.5f;
        [SerializeField] private float turbulenceScale = 10f;

        [Header("Gusts")]
        [SerializeField] private bool enableGusts = true;
        [SerializeField] [Range(0f, 1f)] private float gustProbability = 0.1f;
        [SerializeField] private float gustMagnitudeFactor = 1.5f;
        [SerializeField] private float gustDuration = 2f;

        [Header("Wind Shear")]
        [SerializeField] private bool enableWindShear = true;
        [SerializeField] private float referenceAltitude = 10f;
        [SerializeField] private float shearExponent = 0.143f;

        [Header("Visualization")]
        [SerializeField] private bool showWindGizmos = true;
        [SerializeField] private int gizmoGridSize = 5;
        [SerializeField] private float gizmoSpacing = 5f;

        #endregion

        #region Private Fields

        private float simulationTime;
        private bool gustActive;
        private float gustStartTime;
        private Vector3 gustVelocity;
        private System.Random random;

        private const float AIR_DENSITY = 1.225f;

        #endregion

        #region Properties

        public Vector3 BaseWindVelocity => baseWindVelocity;
        public float WindSpeed => baseWindVelocity.magnitude;
        public float TurbulenceIntensity => turbulenceIntensity;
        public bool IsGustActive => gustActive;

        #endregion

        #region Unity Lifecycle

        private void Awake()
        {
            random = new System.Random();
            UpdateBaseWindFromSpeed();
        }

        private void Update()
        {
            simulationTime += Time.deltaTime;
            UpdateGust();
        }

        #endregion

        #region Wind Configuration

        /// <summary>
        /// Set wind from speed and direction.
        /// </summary>
        public void SetWind(float speed, float directionDegrees)
        {
            baseWindSpeed = speed;
            windDirection = directionDegrees;
            UpdateBaseWindFromSpeed();
        }

        /// <summary>
        /// Set wind velocity directly.
        /// </summary>
        public void SetWindVelocity(Vector3 velocity)
        {
            baseWindVelocity = velocity;
            baseWindSpeed = velocity.magnitude;

            if (baseWindSpeed > 0)
            {
                windDirection = Mathf.Atan2(velocity.x, velocity.z) * Mathf.Rad2Deg;
            }
        }

        /// <summary>
        /// Set turbulence intensity (0-1).
        /// </summary>
        public void SetTurbulence(float intensity)
        {
            turbulenceIntensity = Mathf.Clamp01(intensity);
        }

        private void UpdateBaseWindFromSpeed()
        {
            float dirRad = windDirection * Mathf.Deg2Rad;
            baseWindVelocity = new Vector3(
                Mathf.Sin(dirRad) * baseWindSpeed,
                0,
                Mathf.Cos(dirRad) * baseWindSpeed
            );
        }

        #endregion

        #region Wind Calculation

        /// <summary>
        /// Get wind velocity at a specific position and time.
        /// </summary>
        public Vector3 GetWindVelocity(Vector3 position)
        {
            Vector3 wind = baseWindVelocity;

            // Apply wind shear (altitude effect)
            if (enableWindShear && position.y > 0.1f)
            {
                float shearFactor = Mathf.Pow(position.y / referenceAltitude, shearExponent);
                wind *= shearFactor;
            }

            // Add turbulence
            if (enableTurbulence && turbulenceIntensity > 0 && baseWindSpeed > 0)
            {
                Vector3 turbulence = CalculateTurbulence(position);
                wind += turbulence;
            }

            // Add gust
            if (gustActive)
            {
                wind += GetGustContribution();
            }

            return wind;
        }

        /// <summary>
        /// Calculate wind force on an object.
        /// F = 0.5 * rho * v^2 * Cd * A
        /// </summary>
        public Vector3 GetWindForce(Vector3 position, float frontalArea, float dragCoefficient)
        {
            Vector3 windVelocity = GetWindVelocity(position);
            float windSpeed = windVelocity.magnitude;

            if (windSpeed < 0.01f) return Vector3.zero;

            // Calculate wind force magnitude
            float forceMagnitude = 0.5f * AIR_DENSITY * windSpeed * windSpeed * dragCoefficient * frontalArea;

            // Force direction is wind direction
            return windVelocity.normalized * forceMagnitude;
        }

        #endregion

        #region Turbulence

        private Vector3 CalculateTurbulence(Vector3 position)
        {
            // Time-based noise coordinate
            float t = simulationTime * turbulenceFrequency;

            // Position-based noise coordinates
            float px = position.x / turbulenceScale;
            float py = position.y / turbulenceScale;
            float pz = position.z / turbulenceScale;

            // Calculate noise for each component
            float noiseX = PerlinNoise3D(t, py, pz);
            float noiseY = PerlinNoise3D(px, t, pz) * 0.5f; // Less vertical turbulence
            float noiseZ = PerlinNoise3D(px, py, t);

            // Scale by base wind speed and intensity
            float magnitude = baseWindSpeed * turbulenceIntensity;

            return new Vector3(noiseX, noiseY, noiseZ) * magnitude;
        }

        /// <summary>
        /// 3D Perlin noise approximation using Unity's 2D Perlin noise.
        /// </summary>
        private float PerlinNoise3D(float x, float y, float z)
        {
            // Combine multiple 2D noise samples
            float xy = Mathf.PerlinNoise(x, y);
            float xz = Mathf.PerlinNoise(x + 100, z);
            float yz = Mathf.PerlinNoise(y + 200, z);

            // Average and center around 0
            return ((xy + xz + yz) / 3f - 0.5f) * 2f;
        }

        #endregion

        #region Gusts

        private void UpdateGust()
        {
            if (!enableGusts) return;

            // Check if current gust has ended
            if (gustActive)
            {
                if (simulationTime - gustStartTime > gustDuration)
                {
                    gustActive = false;
                }
            }

            // Check for new gust
            if (!gustActive)
            {
                // Probability check (adjusted for frame time)
                if (Random.value < gustProbability * Time.deltaTime)
                {
                    StartGust();
                }
            }
        }

        private void StartGust()
        {
            gustActive = true;
            gustStartTime = simulationTime;

            // Random gust direction (biased toward base wind)
            Vector3 baseDir = baseWindVelocity.normalized;
            if (baseDir.magnitude < 0.1f)
            {
                baseDir = Vector3.forward;
            }

            Vector3 randomOffset = new Vector3(
                (float)(random.NextDouble() - 0.5) * 0.5f,
                (float)(random.NextDouble() - 0.5) * 0.2f,
                (float)(random.NextDouble() - 0.5) * 0.5f
            );

            Vector3 gustDir = (baseDir + randomOffset).normalized;

            // Gust speed
            float gustSpeed = baseWindSpeed * gustMagnitudeFactor * (float)random.NextDouble();

            gustVelocity = gustDir * gustSpeed;
        }

        private Vector3 GetGustContribution()
        {
            if (!gustActive) return Vector3.zero;

            // Gust envelope (ramp up, hold, ramp down)
            float gustTime = simulationTime - gustStartTime;
            float rampTime = gustDuration * 0.2f;
            float envelope;

            if (gustTime < rampTime)
            {
                // Ramp up
                envelope = gustTime / rampTime;
            }
            else if (gustTime > gustDuration - rampTime)
            {
                // Ramp down
                envelope = (gustDuration - gustTime) / rampTime;
            }
            else
            {
                // Hold
                envelope = 1f;
            }

            return gustVelocity * envelope;
        }

        #endregion

        #region Utility

        /// <summary>
        /// Convert Beaufort scale to wind speed (m/s).
        /// </summary>
        public static float BeaufortToSpeed(int beaufort)
        {
            float[] speeds = { 0f, 0.8f, 2.4f, 4.4f, 6.7f, 9.4f, 12.3f, 15.5f, 18.9f, 22.6f, 26.5f, 30.6f, 33f };
            beaufort = Mathf.Clamp(beaufort, 0, 12);
            return speeds[beaufort];
        }

        /// <summary>
        /// Convert wind speed to Beaufort scale.
        /// </summary>
        public static int SpeedToBeaufort(float speed)
        {
            if (speed < 0.3f) return 0;
            if (speed < 1.6f) return 1;
            if (speed < 3.4f) return 2;
            if (speed < 5.5f) return 3;
            if (speed < 8f) return 4;
            if (speed < 10.8f) return 5;
            if (speed < 13.9f) return 6;
            if (speed < 17.2f) return 7;
            if (speed < 20.8f) return 8;
            if (speed < 24.5f) return 9;
            if (speed < 28.5f) return 10;
            if (speed < 32.7f) return 11;
            return 12;
        }

        /// <summary>
        /// Get wind description for UI.
        /// </summary>
        public string GetWindDescription()
        {
            int beaufort = SpeedToBeaufort(baseWindSpeed);
            string[] descriptions = {
                "Calm", "Light air", "Light breeze", "Gentle breeze",
                "Moderate breeze", "Fresh breeze", "Strong breeze", "Near gale",
                "Gale", "Strong gale", "Storm", "Violent storm", "Hurricane"
            };

            return $"{descriptions[beaufort]} ({baseWindSpeed:F1} m/s)";
        }

        #endregion

        #region Debug

        private void OnDrawGizmos()
        {
            if (!showWindGizmos || baseWindSpeed < 0.1f) return;

            Gizmos.color = new Color(0, 0.5f, 1f, 0.5f);

            // Draw wind arrows in a grid
            Vector3 center = transform.position;
            float halfSize = (gizmoGridSize - 1) * gizmoSpacing * 0.5f;

            for (int x = 0; x < gizmoGridSize; x++)
            {
                for (int z = 0; z < gizmoGridSize; z++)
                {
                    Vector3 pos = center + new Vector3(
                        x * gizmoSpacing - halfSize,
                        0,
                        z * gizmoSpacing - halfSize
                    );

                    Vector3 wind = GetWindVelocity(pos);
                    float length = wind.magnitude * 0.2f;

                    if (length > 0.1f)
                    {
                        DrawArrow(pos, wind.normalized * length);
                    }
                }
            }
        }

        private void DrawArrow(Vector3 position, Vector3 direction)
        {
            Gizmos.DrawRay(position, direction);

            // Arrowhead
            Vector3 right = Vector3.Cross(direction.normalized, Vector3.up).normalized;
            Vector3 arrowEnd = position + direction;
            float arrowSize = direction.magnitude * 0.2f;

            Gizmos.DrawRay(arrowEnd, (-direction.normalized + right) * arrowSize);
            Gizmos.DrawRay(arrowEnd, (-direction.normalized - right) * arrowSize);
        }

        #endregion
    }
}

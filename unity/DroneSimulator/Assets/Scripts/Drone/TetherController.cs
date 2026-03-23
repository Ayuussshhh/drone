using UnityEngine;

namespace DroneSimulator
{
    /// <summary>
    /// Simulates tether physics using a spring-damper model.
    /// Provides realistic constraint behavior for window-cleaning drone scenario.
    /// </summary>
    public class TetherController : MonoBehaviour
    {
        #region Serialized Fields

        [Header("Tether Configuration")]
        [SerializeField] private bool isEnabled = true;
        [SerializeField] private float tetherLength = 10f;
        [SerializeField] private float stiffness = 10000f;
        [SerializeField] private float damping = 100f;
        [SerializeField] private float breakingStrength = 5000f;
        [SerializeField] private float massPerMeter = 0.05f;

        [Header("Attachment Points")]
        [SerializeField] private Transform anchorPoint;
        [SerializeField] private Vector3 droneAttachmentOffset = new Vector3(0, -0.1f, 0);

        [Header("Visual")]
        [SerializeField] private LineRenderer lineRenderer;
        [SerializeField] private int lineSegments = 20;
        [SerializeField] private Color slackColor = Color.green;
        [SerializeField] private Color tautColor = Color.yellow;
        [SerializeField] private Color strainedColor = Color.red;

        [Header("Catenary")]
        [SerializeField] private bool simulateCatenary = true;
        [SerializeField] private float maxSag = 2f;

        #endregion

        #region Private Fields

        private DroneController droneController;
        private float currentLength;
        private float currentTension;
        private float previousLength;
        private bool isTaut;
        private bool isBroken;

        private const float GRAVITY = 9.81f;

        #endregion

        #region Properties

        public bool IsEnabled => isEnabled && !isBroken;
        public float CurrentTension => currentTension;
        public float CurrentLength => currentLength;
        public bool IsTaut => isTaut;
        public bool IsBroken => isBroken;

        public float AngleFromVertical
        {
            get
            {
                if (anchorPoint == null || droneController == null) return 0;

                Vector3 tetherVector = GetAttachmentWorldPosition() - anchorPoint.position;
                float cosAngle = Vector3.Dot(tetherVector.normalized, Vector3.up);
                return Mathf.Acos(Mathf.Clamp(cosAngle, -1f, 1f)) * Mathf.Rad2Deg;
            }
        }

        public float SafetyFactor => breakingStrength / Mathf.Max(currentTension, 0.001f);

        #endregion

        #region Unity Lifecycle

        private void Start()
        {
            droneController = GetComponentInParent<DroneController>();

            // Create default anchor if not assigned
            if (anchorPoint == null)
            {
                GameObject anchor = new GameObject("TetherAnchor");
                anchor.transform.position = Vector3.zero;
                anchorPoint = anchor.transform;
            }

            // Setup line renderer
            SetupLineRenderer();

            previousLength = tetherLength;
        }

        private void Update()
        {
            if (!isEnabled || isBroken) return;

            UpdateVisual();
        }

        #endregion

        #region Force Calculation

        /// <summary>
        /// Calculate tether force using spring-damper model.
        /// F = -k*x - c*v
        /// </summary>
        public Vector3 GetTetherForce(Vector3 dronePosition, Vector3 droneVelocity)
        {
            if (!isEnabled || isBroken || anchorPoint == null)
            {
                currentTension = 0;
                return Vector3.zero;
            }

            // Get attachment point in world space
            Vector3 attachmentWorld = dronePosition + droneAttachmentOffset;

            // Calculate current tether vector and length
            Vector3 tetherVector = attachmentWorld - anchorPoint.position;
            currentLength = tetherVector.magnitude;

            // Calculate extension (positive when stretched beyond natural length)
            float extension = currentLength - tetherLength;

            // Tether direction (from drone toward anchor)
            Vector3 tetherDirection = -tetherVector.normalized;

            // Calculate extension rate (how fast the tether is stretching)
            float extensionRate = (currentLength - previousLength) / Time.fixedDeltaTime;
            previousLength = currentLength;

            // Check if taut
            isTaut = extension > 0;

            if (!isTaut)
            {
                // Tether is slack - no force
                currentTension = 0;
                return Vector3.zero;
            }

            // Spring force (proportional to extension)
            float springForce = stiffness * extension;

            // Damping force (only when stretching further)
            float dampingForce = 0;
            if (extensionRate > 0)
            {
                dampingForce = damping * extensionRate;
            }

            // Total tension
            currentTension = springForce + dampingForce;

            // Check breaking strength
            if (currentTension > breakingStrength)
            {
                BreakTether();
                return Vector3.zero;
            }

            // Force direction: pull drone toward anchor
            Vector3 force = tetherDirection * currentTension;

            return force;
        }

        /// <summary>
        /// Get attachment offset in local coordinates.
        /// </summary>
        public Vector3 GetAttachmentOffset()
        {
            return droneAttachmentOffset;
        }

        /// <summary>
        /// Get attachment point in world coordinates.
        /// </summary>
        public Vector3 GetAttachmentWorldPosition()
        {
            if (droneController != null)
            {
                return droneController.transform.TransformPoint(droneAttachmentOffset);
            }
            return transform.TransformPoint(droneAttachmentOffset);
        }

        #endregion

        #region Tether Management

        /// <summary>
        /// Set tether length.
        /// </summary>
        public void SetLength(float length)
        {
            tetherLength = Mathf.Max(0.1f, length);
        }

        /// <summary>
        /// Set anchor position.
        /// </summary>
        public void SetAnchorPosition(Vector3 position)
        {
            if (anchorPoint != null)
            {
                anchorPoint.position = position;
            }
        }

        /// <summary>
        /// Enable or disable tether.
        /// </summary>
        public void SetEnabled(bool enabled)
        {
            isEnabled = enabled;

            if (lineRenderer != null)
            {
                lineRenderer.enabled = enabled && !isBroken;
            }
        }

        /// <summary>
        /// Break the tether (exceeds breaking strength).
        /// </summary>
        private void BreakTether()
        {
            isBroken = true;
            currentTension = 0;

            if (lineRenderer != null)
            {
                lineRenderer.enabled = false;
            }

            Debug.LogWarning("Tether broken! Exceeded breaking strength.");
        }

        /// <summary>
        /// Repair/reset tether.
        /// </summary>
        public void RepairTether()
        {
            isBroken = false;

            if (lineRenderer != null)
            {
                lineRenderer.enabled = isEnabled;
            }
        }

        #endregion

        #region Visualization

        private void SetupLineRenderer()
        {
            if (lineRenderer == null)
            {
                lineRenderer = gameObject.AddComponent<LineRenderer>();
            }

            lineRenderer.positionCount = lineSegments;
            lineRenderer.startWidth = 0.02f;
            lineRenderer.endWidth = 0.02f;
            lineRenderer.material = new Material(Shader.Find("Sprites/Default"));
            lineRenderer.enabled = isEnabled;
        }

        private void UpdateVisual()
        {
            if (lineRenderer == null || anchorPoint == null) return;

            Vector3 startPos = anchorPoint.position;
            Vector3 endPos = GetAttachmentWorldPosition();

            // Update color based on tension
            Color currentColor;
            if (!isTaut)
            {
                currentColor = slackColor;
            }
            else
            {
                float strainRatio = currentTension / breakingStrength;
                if (strainRatio > 0.7f)
                {
                    currentColor = Color.Lerp(tautColor, strainedColor, (strainRatio - 0.7f) / 0.3f);
                }
                else
                {
                    currentColor = tautColor;
                }
            }

            lineRenderer.startColor = currentColor;
            lineRenderer.endColor = currentColor;

            // Calculate line points with catenary sag
            for (int i = 0; i < lineSegments; i++)
            {
                float t = (float)i / (lineSegments - 1);
                Vector3 point = Vector3.Lerp(startPos, endPos, t);

                // Add catenary sag if slack
                if (simulateCatenary && !isTaut)
                {
                    float sagAmount = CalculateSag(t);
                    point.y -= sagAmount;
                }

                lineRenderer.SetPosition(i, point);
            }
        }

        private float CalculateSag(float t)
        {
            // Parabolic approximation of catenary
            // Maximum sag at t = 0.5
            float sagFactor = 4f * t * (1f - t); // Peaks at 0.5

            // Sag depends on how slack the tether is
            float slackAmount = Mathf.Max(0, tetherLength - currentLength);
            float sagMultiplier = Mathf.Min(slackAmount * 0.5f, maxSag);

            // Also consider tether weight
            float weightSag = massPerMeter * tetherLength * GRAVITY * 0.01f;

            return sagFactor * (sagMultiplier + weightSag);
        }

        #endregion

        #region Utility

        /// <summary>
        /// Calculate operating envelope for tethered flight.
        /// </summary>
        public TetherEnvelope GetOperatingEnvelope()
        {
            return new TetherEnvelope
            {
                maxRadius = Mathf.Sqrt(tetherLength * tetherLength - 4f), // Assuming 2m min altitude
                maxAltitude = tetherLength,
                minAltitude = 1f,
                maxSafeTension = breakingStrength * 0.6f,
                pendulumFrequency = 1f / (2f * Mathf.PI) * Mathf.Sqrt(GRAVITY / tetherLength)
            };
        }

        /// <summary>
        /// Get maximum swing angle for given horizontal force.
        /// </summary>
        public float GetMaxSwingAngle(float horizontalForce, float droneMass)
        {
            float weight = droneMass * GRAVITY;
            return Mathf.Atan2(horizontalForce, weight) * Mathf.Rad2Deg;
        }

        #endregion

        #region Debug

        private void OnDrawGizmos()
        {
            if (anchorPoint == null) return;

            // Draw anchor point
            Gizmos.color = Color.blue;
            Gizmos.DrawWireSphere(anchorPoint.position, 0.1f);

            // Draw tether length sphere
            Gizmos.color = new Color(0, 1, 0, 0.2f);
            Gizmos.DrawWireSphere(anchorPoint.position, tetherLength);

            // Draw attachment point
            Gizmos.color = Color.yellow;
            Gizmos.DrawWireSphere(GetAttachmentWorldPosition(), 0.05f);
        }

        private void OnDrawGizmosSelected()
        {
            if (anchorPoint == null) return;

            // Draw tension force
            if (isTaut && currentTension > 0)
            {
                Gizmos.color = Color.red;
                Vector3 forceDir = (anchorPoint.position - GetAttachmentWorldPosition()).normalized;
                Gizmos.DrawRay(GetAttachmentWorldPosition(), forceDir * currentTension * 0.01f);
            }
        }

        #endregion
    }

    /// <summary>
    /// Operating envelope for tethered flight.
    /// </summary>
    [System.Serializable]
    public struct TetherEnvelope
    {
        public float maxRadius;
        public float maxAltitude;
        public float minAltitude;
        public float maxSafeTension;
        public float pendulumFrequency;
    }
}

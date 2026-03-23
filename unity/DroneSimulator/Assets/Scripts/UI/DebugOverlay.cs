using UnityEngine;

namespace DroneSimulator
{
    /// <summary>
    /// Debug overlay UI showing real-time drone metrics.
    /// </summary>
    public class DebugOverlay : MonoBehaviour
    {
        #region Serialized Fields

        [Header("References")]
        [SerializeField] private DroneController droneController;
        [SerializeField] private StabilitySystem stabilitySystem;
        [SerializeField] private WindSimulator windSimulator;
        [SerializeField] private TetherController tetherController;
        [SerializeField] private SimulationSync simulationSync;

        [Header("Display")]
        [SerializeField] private bool showOverlay = true;
        [SerializeField] private KeyCode toggleKey = KeyCode.F1;
        [SerializeField] private int fontSize = 14;

        [Header("Panels")]
        [SerializeField] private bool showFlightPanel = true;
        [SerializeField] private bool showStabilityPanel = true;
        [SerializeField] private bool showWindPanel = true;
        [SerializeField] private bool showTetherPanel = true;
        [SerializeField] private bool showNetworkPanel = true;
        [SerializeField] private bool showControlsPanel = true;

        #endregion

        #region Private Fields

        private GUIStyle boxStyle;
        private GUIStyle labelStyle;
        private GUIStyle headerStyle;
        private GUIStyle valueStyle;
        private bool stylesInitialized;

        #endregion

        #region Unity Lifecycle

        private void Start()
        {
            // Auto-find references
            if (droneController == null) droneController = FindObjectOfType<DroneController>();
            if (stabilitySystem == null) stabilitySystem = FindObjectOfType<StabilitySystem>();
            if (windSimulator == null) windSimulator = FindObjectOfType<WindSimulator>();
            if (tetherController == null) tetherController = FindObjectOfType<TetherController>();
            if (simulationSync == null) simulationSync = FindObjectOfType<SimulationSync>();
        }

        private void Update()
        {
            if (Input.GetKeyDown(toggleKey))
            {
                showOverlay = !showOverlay;
            }
        }

        private void OnGUI()
        {
            if (!showOverlay) return;

            InitializeStyles();

            float panelWidth = 280;
            float panelX = 10;
            float panelY = 10;
            float panelSpacing = 10;

            // Flight Status Panel
            if (showFlightPanel && droneController != null)
            {
                panelY = DrawFlightPanel(panelX, panelY, panelWidth);
                panelY += panelSpacing;
            }

            // Stability Panel
            if (showStabilityPanel && stabilitySystem != null)
            {
                panelY = DrawStabilityPanel(panelX, panelY, panelWidth);
                panelY += panelSpacing;
            }

            // Wind Panel
            if (showWindPanel && windSimulator != null)
            {
                panelY = DrawWindPanel(panelX, panelY, panelWidth);
                panelY += panelSpacing;
            }

            // Tether Panel
            if (showTetherPanel && tetherController != null)
            {
                panelY = DrawTetherPanel(panelX, panelY, panelWidth);
                panelY += panelSpacing;
            }

            // Network Panel (right side)
            if (showNetworkPanel && simulationSync != null)
            {
                DrawNetworkPanel(Screen.width - panelWidth - 10, 10, panelWidth);
            }

            // Controls Panel (bottom)
            if (showControlsPanel)
            {
                DrawControlsPanel();
            }
        }

        #endregion

        #region Panel Drawing

        private float DrawFlightPanel(float x, float y, float width)
        {
            var state = droneController.CurrentState;

            GUILayout.BeginArea(new Rect(x, y, width, 200), boxStyle);
            GUILayout.Label("FLIGHT STATUS", headerStyle);

            // Status indicator
            string status = state?.flightStatus.ToString() ?? "Unknown";
            Color statusColor = GetStatusColor(state?.flightStatus ?? FlightStatus.Grounded);
            GUI.color = statusColor;
            GUILayout.Label($"Status: {status}", valueStyle);
            GUI.color = Color.white;

            DrawMetric("Altitude", state?.altitude ?? 0, "m");
            DrawMetric("Air Speed", state?.airSpeed ?? 0, "m/s");
            DrawMetric("Ground Speed", state?.groundSpeed ?? 0, "m/s");
            DrawMetric("Tilt Angle", droneController.GetTiltAngle(), "°");
            DrawMetric("T/W Ratio", droneController.ThrustToWeightRatio, "");

            // Motor thrusts
            if (state?.motorThrusts != null)
            {
                GUILayout.Label("Motor Thrusts:", labelStyle);
                string thrusts = "";
                for (int i = 0; i < state.motorThrusts.Length; i++)
                {
                    thrusts += $"M{i + 1}: {state.motorThrusts[i]:F1}N  ";
                }
                GUILayout.Label(thrusts, valueStyle);
            }

            GUILayout.EndArea();

            return y + 200;
        }

        private float DrawStabilityPanel(float x, float y, float width)
        {
            var report = stabilitySystem.GetReport();

            GUILayout.BeginArea(new Rect(x, y, width, 180), boxStyle);
            GUILayout.Label("STABILITY", headerStyle);

            // Score with color
            Color scoreColor = GetScoreColor(report.stabilityScore);
            GUI.color = scoreColor;
            GUILayout.Label($"Score: {report.stabilityScore:F0}% ({report.stabilityClass})", valueStyle);
            GUI.color = Color.white;

            DrawMetric("Tilt", report.currentTilt, "°");
            DrawMetric("Tilt Margin", report.tiltMargin, "°");
            DrawMetric("Torque Imbalance", report.torqueImbalance, "N·m");

            // Control authority
            GUILayout.Label("Control Authority:", labelStyle);
            DrawProgressBar("Roll", report.controlAuthority.roll);
            DrawProgressBar("Pitch", report.controlAuthority.pitch);
            DrawProgressBar("Alt", report.controlAuthority.altitude);

            // Warnings
            if (report.criticalIssues.Count > 0)
            {
                GUI.color = Color.red;
                GUILayout.Label($"⚠ {report.criticalIssues[0]}", labelStyle);
                GUI.color = Color.white;
            }
            else if (report.warnings.Count > 0)
            {
                GUI.color = Color.yellow;
                GUILayout.Label($"⚠ {report.warnings[0]}", labelStyle);
                GUI.color = Color.white;
            }

            GUILayout.EndArea();

            return y + 180;
        }

        private float DrawWindPanel(float x, float y, float width)
        {
            GUILayout.BeginArea(new Rect(x, y, width, 100), boxStyle);
            GUILayout.Label("WIND", headerStyle);

            DrawMetric("Speed", windSimulator.WindSpeed, "m/s");
            GUILayout.Label($"Description: {windSimulator.GetWindDescription()}", labelStyle);
            DrawMetric("Turbulence", windSimulator.TurbulenceIntensity * 100, "%");

            if (windSimulator.IsGustActive)
            {
                GUI.color = Color.yellow;
                GUILayout.Label("GUST ACTIVE", valueStyle);
                GUI.color = Color.white;
            }

            GUILayout.EndArea();

            return y + 100;
        }

        private float DrawTetherPanel(float x, float y, float width)
        {
            GUILayout.BeginArea(new Rect(x, y, width, 120), boxStyle);
            GUILayout.Label("TETHER", headerStyle);

            if (!tetherController.IsEnabled)
            {
                GUILayout.Label("Disabled", labelStyle);
            }
            else if (tetherController.IsBroken)
            {
                GUI.color = Color.red;
                GUILayout.Label("BROKEN!", valueStyle);
                GUI.color = Color.white;
            }
            else
            {
                DrawMetric("Length", tetherController.CurrentLength, "m");
                DrawMetric("Tension", tetherController.CurrentTension, "N");
                DrawMetric("Angle", tetherController.AngleFromVertical, "°");

                // Safety indicator
                float safety = tetherController.SafetyFactor;
                Color safetyColor = safety > 3 ? Color.green : safety > 1.5f ? Color.yellow : Color.red;
                GUI.color = safetyColor;
                GUILayout.Label($"Safety Factor: {safety:F1}x", labelStyle);
                GUI.color = Color.white;

                GUILayout.Label($"Taut: {(tetherController.IsTaut ? "Yes" : "No")}", labelStyle);
            }

            GUILayout.EndArea();

            return y + 120;
        }

        private void DrawNetworkPanel(float x, float y, float width)
        {
            GUILayout.BeginArea(new Rect(x, y, width, 120), boxStyle);
            GUILayout.Label("NETWORK", headerStyle);

            // Connection status
            bool connected = simulationSync.IsConnected;
            GUI.color = connected ? Color.green : Color.red;
            GUILayout.Label($"Status: {(connected ? "Connected" : "Disconnected")}", valueStyle);
            GUI.color = Color.white;

            GUILayout.Label($"Sync Mode: {simulationSync.Mode}", labelStyle);
            GUILayout.Label($"Simulation: {(simulationSync.IsSimulationActive ? "Active" : "Inactive")}", labelStyle);

            // Controls
            GUILayout.BeginHorizontal();
            if (GUILayout.Button("Start Sim"))
            {
                simulationSync.StartSimulation();
            }
            if (GUILayout.Button("Stop Sim"))
            {
                simulationSync.StopSimulation();
            }
            GUILayout.EndHorizontal();

            if (GUILayout.Button("Reset"))
            {
                simulationSync.ResetSimulation();
            }

            GUILayout.EndArea();
        }

        private void DrawControlsPanel()
        {
            float panelHeight = 80;
            float panelY = Screen.height - panelHeight - 10;

            GUILayout.BeginArea(new Rect(10, panelY, Screen.width - 20, panelHeight), boxStyle);
            GUILayout.Label("CONTROLS: WASD = Move | QE = Yaw | Space = Throttle Up | LShift = Throttle Down | R = Reset | F1 = Toggle UI", labelStyle);

            GUILayout.BeginHorizontal();

            // Throttle slider
            GUILayout.Label("Throttle:", GUILayout.Width(60));
            float[] throttles = droneController.MotorThrottles;
            float avgThrottle = throttles != null && throttles.Length > 0 ?
                (throttles[0] + throttles[1] + throttles[2] + throttles[3]) / 4f : 0f;
            float newThrottle = GUILayout.HorizontalSlider(avgThrottle, 0f, 1f, GUILayout.Width(200));

            if (Mathf.Abs(newThrottle - avgThrottle) > 0.01f)
            {
                droneController.SetThrottle(newThrottle);
            }

            GUILayout.Label($"{newThrottle * 100:F0}%", GUILayout.Width(40));

            GUILayout.FlexibleSpace();

            // Quick buttons
            if (GUILayout.Button("Hover", GUILayout.Width(60)))
            {
                droneController.SetThrottle(droneController.GetHoverThrottle());
            }
            if (GUILayout.Button("Stop", GUILayout.Width(60)))
            {
                droneController.EmergencyStop();
            }
            if (GUILayout.Button("Reset", GUILayout.Width(60)))
            {
                droneController.ResetDrone();
            }

            GUILayout.EndHorizontal();

            GUILayout.EndArea();
        }

        #endregion

        #region Utility

        private void InitializeStyles()
        {
            if (stylesInitialized) return;

            boxStyle = new GUIStyle(GUI.skin.box);
            boxStyle.normal.background = MakeTexture(2, 2, new Color(0.1f, 0.1f, 0.1f, 0.8f));
            boxStyle.padding = new RectOffset(10, 10, 5, 5);

            labelStyle = new GUIStyle(GUI.skin.label);
            labelStyle.fontSize = fontSize;
            labelStyle.normal.textColor = Color.white;

            headerStyle = new GUIStyle(labelStyle);
            headerStyle.fontSize = fontSize + 2;
            headerStyle.fontStyle = FontStyle.Bold;
            headerStyle.normal.textColor = new Color(0.5f, 0.8f, 1f);

            valueStyle = new GUIStyle(labelStyle);
            valueStyle.fontStyle = FontStyle.Bold;

            stylesInitialized = true;
        }

        private Texture2D MakeTexture(int width, int height, Color color)
        {
            Color[] pixels = new Color[width * height];
            for (int i = 0; i < pixels.Length; i++)
            {
                pixels[i] = color;
            }

            Texture2D texture = new Texture2D(width, height);
            texture.SetPixels(pixels);
            texture.Apply();
            return texture;
        }

        private void DrawMetric(string name, float value, string unit)
        {
            GUILayout.BeginHorizontal();
            GUILayout.Label($"{name}:", labelStyle, GUILayout.Width(100));
            GUILayout.Label($"{value:F2} {unit}", valueStyle);
            GUILayout.EndHorizontal();
        }

        private void DrawProgressBar(string label, float value)
        {
            GUILayout.BeginHorizontal();
            GUILayout.Label(label, labelStyle, GUILayout.Width(40));

            Rect rect = GUILayoutUtility.GetRect(100, 15);
            GUI.Box(rect, "");

            Color barColor = value > 70 ? Color.green : value > 30 ? Color.yellow : Color.red;
            GUI.color = barColor;
            GUI.Box(new Rect(rect.x, rect.y, rect.width * value / 100f, rect.height), "");
            GUI.color = Color.white;

            GUILayout.Label($"{value:F0}%", labelStyle, GUILayout.Width(40));
            GUILayout.EndHorizontal();
        }

        private Color GetStatusColor(FlightStatus status)
        {
            switch (status)
            {
                case FlightStatus.Flying:
                case FlightStatus.Hovering:
                    return Color.green;
                case FlightStatus.Grounded:
                    return Color.white;
                case FlightStatus.Unstable:
                    return Color.yellow;
                case FlightStatus.Crashed:
                    return Color.red;
                default:
                    return Color.gray;
            }
        }

        private Color GetScoreColor(float score)
        {
            if (score >= 80) return Color.green;
            if (score >= 50) return Color.yellow;
            if (score >= 20) return new Color(1f, 0.5f, 0f); // Orange
            return Color.red;
        }

        #endregion
    }
}

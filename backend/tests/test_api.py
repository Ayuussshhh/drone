"""
Unit tests for the REST API endpoints.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.drone import (
    Motor,
    MotorType,
    Propeller,
    PropellerType,
    Battery,
    BatteryType,
    Frame,
    FrameType,
    DroneConfiguration,
    Vector3,
)


@pytest.fixture
def client():
    """Create test client."""
    return TestClient(app)


@pytest.fixture
def sample_config_dict():
    """Sample drone configuration as a dictionary."""
    return {
        "id": "test_drone",
        "name": "Test Quadcopter",
        "motors": [
            {
                "id": f"motor_{i}",
                "name": f"Motor {i}",
                "motor_type": "brushless",
                "mass": 0.05,
                "kv_rating": 920,
                "thrust_constant": 1.5e-5,
                "max_rpm": 12000,
                "max_current": 20,
                "position": {
                    "x": 0.15 * (1 if i in [0, 3] else -1),
                    "y": 0,
                    "z": 0.15 * (1 if i in [0, 1] else -1),
                },
                "rotation_direction": 1 if i in [0, 2] else -1,
            }
            for i in range(4)
        ],
        "propellers": [
            {
                "id": f"prop_{i}",
                "name": "10x4.5 Propeller",
                "diameter": 0.254,
                "pitch": 0.114,
                "mass": 0.015,
                "blade_count": "2-blade",
            }
            for i in range(4)
        ],
        "battery": {
            "id": "battery_1",
            "name": "4S 5000mAh",
            "battery_type": "LiPo",
            "cell_count": 4,
            "capacity_mah": 5000,
            "mass": 0.5,
            "max_discharge_rate": 50,
        },
        "frame": {
            "id": "frame_1",
            "name": "450mm Frame",
            "frame_type": "quad_x",
            "mass": 0.3,
            "arm_length": 0.225,
            "diagonal_distance": 0.45,
            "frontal_area": 0.04,
        },
    }


class TestHealthEndpoint:
    """Tests for health check endpoint."""

    def test_health_check(self, client):
        response = client.get("/api/health")
        assert response.status_code == 200

        data = response.json()
        assert data["status"] == "healthy"
        assert "version" in data
        assert "uptime" in data


class TestRootEndpoint:
    """Tests for root endpoint."""

    def test_root(self, client):
        response = client.get("/")
        assert response.status_code == 200

        data = response.json()
        assert "name" in data
        assert "version" in data


class TestValidateEndpoint:
    """Tests for configuration validation endpoint."""

    def test_validate_valid_config(self, client, sample_config_dict):
        response = client.post("/api/validate", json=sample_config_dict)
        assert response.status_code == 200

        data = response.json()
        assert data["valid"] is True
        assert data["can_fly"] is True
        assert data["thrust_to_weight_ratio"] > 1.0

    def test_validate_returns_metrics(self, client, sample_config_dict):
        response = client.post("/api/validate", json=sample_config_dict)
        data = response.json()

        assert "total_mass" in data
        assert "max_thrust" in data
        assert "min_throttle_to_hover" in data
        assert "max_payload_capacity" in data
        assert "summary" in data


class TestSimulateEndpoint:
    """Tests for simulation endpoint."""

    def test_simulate_basic(self, client, sample_config_dict):
        request_data = {
            "drone_config": sample_config_dict,
            "parameters": {
                "max_duration": 2.0,
            },
        }

        response = client.post("/api/simulate", json=request_data)
        assert response.status_code == 200

        data = response.json()
        assert "success" in data
        assert "can_fly" in data
        assert "metrics" in data
        assert "stability" in data

    def test_simulate_with_wind(self, client, sample_config_dict):
        request_data = {
            "drone_config": sample_config_dict,
            "parameters": {
                "max_duration": 2.0,
                "wind_velocity": {"x": 5, "y": 0, "z": 0},
                "enable_wind": True,
            },
        }

        response = client.post("/api/simulate", json=request_data)
        assert response.status_code == 200


class TestQuickAnalysisEndpoint:
    """Tests for quick analysis endpoint."""

    def test_quick_analysis(self, client, sample_config_dict):
        response = client.post("/api/quick-analysis", json=sample_config_dict)
        assert response.status_code == 200

        data = response.json()
        assert "can_fly" in data
        assert "hover_throttle_percent" in data
        assert "metrics" in data
        assert "stability" in data
        assert "flight_envelope" in data


class TestComponentsEndpoint:
    """Tests for components list endpoint."""

    def test_list_components(self, client):
        response = client.get("/api/components")
        assert response.status_code == 200

        data = response.json()
        assert "motors" in data
        assert "propellers" in data
        assert "batteries" in data
        assert "frames" in data
        assert "payloads" in data
        assert "tethers" in data


class TestSampleConfigEndpoint:
    """Tests for sample configuration endpoint."""

    def test_get_sample_config(self, client):
        response = client.get("/api/sample-config")
        assert response.status_code == 200

        data = response.json()
        assert "motors" in data
        assert "propellers" in data
        assert "battery" in data
        assert "frame" in data
        assert len(data["motors"]) == 4


class TestErrorHandling:
    """Tests for API error handling."""

    def test_invalid_config_missing_motors(self, client):
        invalid_config = {
            "id": "bad_drone",
            "name": "Bad Drone",
            "motors": [],
            "propellers": [],
            "battery": {
                "id": "b1",
                "name": "Battery",
                "cell_count": 4,
                "capacity_mah": 5000,
                "mass": 0.5,
                "max_discharge_rate": 50,
            },
            "frame": {
                "id": "f1",
                "name": "Frame",
                "mass": 0.3,
                "arm_length": 0.225,
                "diagonal_distance": 0.45,
                "frontal_area": 0.04,
            },
        }

        response = client.post("/api/validate", json=invalid_config)
        # Should handle the validation error
        assert response.status_code in [200, 400, 422]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

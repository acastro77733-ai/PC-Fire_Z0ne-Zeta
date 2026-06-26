
export const SPI_ENGINE_SCRIPT = `
import os
import logging
from datetime import datetime
from dataclasses import dataclass
from typing import List, Dict, Any
import asyncio
import json

# Initialize numpy and genai to None, will be set after installation/import
np = None
genai = None

# ============= 1. INSTALL DEPENDENCIES & IMPORT =============
try:
    import micropip
    print("Installing dependencies...")
    try:
        # Install numpy first, as it's used throughout the code
        await micropip.install("numpy")
        print("Numpy installed.")
        import numpy as np # Import numpy AFTER installation
        
        # Then install Gemini SDK
        await micropip.install("google-generativeai")
        print("Gemini SDK installed.")
        import google.generativeai as genai # Import genai AFTER installation
    except Exception as e:
        print(f"Note: Could not install all dependencies ({e}). Running in simulation mode where possible.")
except ImportError:
    # Running in non-Pyodide environment, try regular imports
    print("Running in non-Pyodide environment or micropip missing. Attempting direct imports.")
    try:
        import numpy as np
        import google.generativeai as genai
        print("Numpy and Gemini SDK imported.")
    except ImportError as e:
        print(f"Error importing modules directly: {e}. Running in simulation mode.")

if np is None:
    # Fallback for critical failure if numpy absolutely cannot load
    class MockNumpy:
        def maximum(self, a, b): return b if b > a else a
        def clip(self, x, a, b): return max(a, min(x, b))
        def exp(self, x): return 2.71828**x
        def tanh(self, x): return (2.71828**(2*x) - 1) / (2.71828**(2*x) + 1)
        def sqrt(self, x): return x**0.5
        def zeros(self, shape): return [0.0] * shape if isinstance(shape, int) else [0.0]
        def dot(self, a, b): return 0.0 # Mock
        def array(self, x, dtype=None): return x
        def mean(self, x): return sum(x)/len(x) if hasattr(x, '__len__') else x
        def abs(self, x): return abs(x)
        class linalg:
            @staticmethod
            def norm(x): return 0.5
        class random:
            @staticmethod
            def randn(*args): return MockNumpy().array([0.5]*args[0]) if args else 0.5
            @staticmethod
            def rand(*args): return MockNumpy().array([0.5]*args[0]) if args else 0.5
        float32 = float
    np = MockNumpy()
    print("CRITICAL: Using Mock Numpy. Results will be simulated.")


# Configure logging
logging.basicConfig(level=os.getenv('LOG_LEVEL', 'INFO'),
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ============= 2. NUMPY AI ENGINE (Browser Compatible) =============

def relu(x):
    return np.maximum(0, x)

def sigmoid(x):
    # Clip to prevent overflow
    x = np.clip(x, -500, 500)
    return 1 / (1 + np.exp(-x))

def tanh(x):
    return np.tanh(x)

class NumpyLinear:
    """Simulates nn.Linear using Numpy"""
    def __init__(self, input_dim, output_dim):
        # Xavier/Glorot initialization simulation
        scale = np.sqrt(2.0 / (input_dim + output_dim))
        self.weights = np.random.randn(input_dim, output_dim) * scale
        self.bias = np.zeros(output_dim)
    
    def __call__(self, x):
        # x: (input_dim,) or (batch, input_dim)
        # weights: (input_dim, output_dim)
        return np.dot(x, self.weights) + self.bias

@dataclass
class SymbolicConfig:
    input_dim: int = 128
    hidden_dim: int = 256
    output_dim: int = 64
    num_layers: int = 3

class PatternModule:
    def __init__(self, input_dim=128, hidden_dim=256):
        self.fc1 = NumpyLinear(input_dim, hidden_dim)
        self.fc2 = NumpyLinear(hidden_dim, hidden_dim)
        self.fc3 = NumpyLinear(hidden_dim, input_dim) # Outputs input_dim (128)
        
    def forward(self, x):
        x = relu(self.fc1(x))
        x = relu(self.fc2(x))
        return self.fc3(x)

class NeuroplasticityManager:
    def __init__(self, dim=256):
        self.adaptation_layer = NumpyLinear(dim, dim)
        self.memory = None
        
    def forward(self, x):
        adapted = tanh(self.adaptation_layer(x))
        if self.memory is None:
            self.memory = adapted
        else:
            self.memory = 0.9 * self.memory + 0.1 * adapted
        return adapted

class SpikingFieldUpdateNN:
    def __init__(self, input_dim=128, hidden_dim=256):
        self.fc = NumpyLinear(input_dim, hidden_dim) 
        self.threshold = 0.5
        
    def forward(self, x):
        potential = sigmoid(self.fc(x))
        spikes = (potential > self.threshold).astype(np.float32)
        return spikes * potential

class SpikingSyntropyNN:
    def __init__(self, dim=256):
        self.syntropy_layer = NumpyLinear(dim, dim)
        
    def forward(self, x):
        return sigmoid(self.syntropy_layer(x))

class SpikingFeedbackNN:
    def __init__(self, dim=256):
        self.feedback_layer = NumpyLinear(dim, dim)
        
    def forward(self, x, feedback=None):
        if feedback is not None:
            x = x + 0.1 * feedback
        return relu(self.feedback_layer(x))

class OscillatorySynapseTheory:
    def __init__(self, dim=256):
        self.oscillator = NumpyLinear(dim, dim)
        self.phase = 0.0
        
    def forward(self, x):
        self.phase += 0.1
        modulation = np.sin(self.phase)
        return tanh(self.oscillator(x)) * modulation

class SymbolicPredictiveInterpreter:
    def __init__(self, config: SymbolicConfig):
        self.config = config
        
        # --- Initialization ---
        # 1. PatternModule: 128 -> 128
        self.pattern_module = PatternModule(config.input_dim, config.hidden_dim)
        
        # 2. Neuroplasticity: Must match PatternModule output (128)
        self.neuroplasticity = NeuroplasticityManager(config.input_dim)
        
        # 3. FieldUpdate: Input 128 -> Output 256
        self.field_update = SpikingFieldUpdateNN(config.input_dim, config.hidden_dim) 
        
        # 4. Syntropy: Input 256 -> Output 256
        self.syntropy = SpikingSyntropyNN(config.hidden_dim)
        
        # 5. Feedback: Input 256 -> Output 256
        self.feedback = SpikingFeedbackNN(config.hidden_dim)
        
        # 6. Oscillator: Input 256 -> Output 256
        self.oscillator = OscillatorySynapseTheory(config.hidden_dim)
        
        logger.info('SymbolicPredictiveInterpreter initialized (Numpy Backend; demo-only)')
        
    def process(self, input_data: np.ndarray) -> Dict[str, Any]:
        try:
            x = np.array(input_data, dtype=np.float32)
            
            # Validate input dimension
            if x.shape[-1] != self.config.input_dim:
                # Basic pad or truncate if mismatch occurs in demo
                if x.shape[-1] > self.config.input_dim:
                    x = x[:self.config.input_dim]
                else:
                    # Pad
                    pass 

            # --- Forward Pass ---
            # 1. Pattern (128 -> 128)
            pattern_output = self.pattern_module.forward(x)
            
            # 2. Neuroplasticity (128 -> 128)
            neuro_adapted_output = self.neuroplasticity.forward(pattern_output)
            
            # 3. Field Update (128 -> 256)
            # We feed the neuro-adapted output into the field update
            field_output = self.field_update.forward(neuro_adapted_output)
            
            # 4. Syntropy (256 -> 256)
            syntropy_output = self.syntropy.forward(field_output)
            
            # 5. Feedback (256 -> 256)
            feedback_output = self.feedback.forward(syntropy_output)
            
            # 6. Oscillator (256 -> 256)
            final_output = self.oscillator.forward(feedback_output)
            
            # Metrics
            memory_norm = 0.0
            if self.neuroplasticity.memory is not None:
                memory_norm = float(np.linalg.norm(self.neuroplasticity.memory))

            return {
                'output': final_output.tolist(),
                'pattern_strength': float(np.mean(np.abs(pattern_output))),
                'syntropy_level': float(np.mean(syntropy_output)),
                'memory_state_norm': memory_norm
            }
        except Exception as e:
            logger.error(f'Processing error: {e}', exc_info=True)
            # Return dummy if failed
            return {
                'output': [],
                'pattern_strength': 0.0,
                'syntropy_level': 0.0,
                'memory_state_norm': 0.0
            }

# ============= 3. DEMONSTRATION LOGIC =============

async def main_demo():
    logger.info("Starting Browser-Compatible AI demonstration (demo-only, not a trained reasoning engine)...")

    # Initialize AI system
    config = SymbolicConfig()
    spi_system = SymbolicPredictiveInterpreter(config)

    # --- Gemini API Configuration ---
    gemini_api_key = os.getenv("GEMINI_API_KEY", "YOUR_GEMINI_API_KEY_HERE")
    
    gemini_ready = False
    if genai and gemini_api_key != "YOUR_GEMINI_API_KEY_HERE":
        try:
            genai.configure(api_key=gemini_api_key)
            print("Gemini API configured.")
            gemini_ready = True
        except Exception as e:
            print(f"Error configuring Gemini API: {e}")
    else:
        print("Gemini API Key not detected or genai not available. Skipping API calls.")

    # --- Text Analysis ---
    test_text = "The emergence of quantum computing could revolutionize cryptography."
    print(f"\\n--- Processing Text: '{test_text}' ---")

    gemini_embedding = None
    if gemini_ready:
        try:
            print(f"Calling Gemini for embedding...")
            model = 'models/embedding-001'
            response = await genai.embed_content_async(model=model, content=test_text)
            gemini_embedding = np.array(response['embedding'], dtype=np.float32)
            
            # Adjust dimension to match input_dim (128)
            if gemini_embedding.shape[0] != config.input_dim:
                if gemini_embedding.shape[0] > config.input_dim:
                    gemini_embedding = gemini_embedding[:config.input_dim]
                else:
                    padding = np.zeros(config.input_dim - gemini_embedding.shape[0], dtype=np.float32)
                    gemini_embedding = np.concatenate((gemini_embedding, padding))
                    
        except Exception as e:
            print(f"Gemini error: {e}. Falling back to random vector.")
            gemini_embedding = None
    
    if gemini_embedding is not None:
        result = spi_system.process(gemini_embedding)
        print(f"Result (Gemini Source): Syntropy Level = {result['syntropy_level']:.4f}")
        print(f"__SPI_METRICS__:{json.dumps(result)}")
    else:
        print("Using random vector simulation (simulating text embedding)...")
        random_vec = np.random.randn(config.input_dim).astype(np.float32)
        result = spi_system.process(random_vec)
        print(f"Result (Random Fallback): Syntropy Level = {result['syntropy_level']:.4f}")
        print(f"__SPI_METRICS__:{json.dumps(result)}")
    
    # --- Numerical Input ---
    print(f"\\n--- Processing Raw Numerical Input ---")
    sample_input = np.random.rand(config.input_dim).astype(np.float32)
    num_result = spi_system.process(sample_input)
    print(f"Result: Pattern Strength = {num_result['pattern_strength']:.4f}")
    print(f"Result: Memory State Norm = {num_result['memory_state_norm']:.4f}")
    print(f"__SPI_METRICS__:{json.dumps(num_result)}")

    logger.info("Demonstration complete.")

# Execute
await main_demo()
`

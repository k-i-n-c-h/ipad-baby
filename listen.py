import pyaudio
import numpy as np

# Constants
FORMAT = pyaudio.paInt16  # Audio format (16-bit PCM)
CHANNELS = 1  # Number of channels (1 for mono)
RATE = 44100  # Sampling rate (44.1 kHz)
CHUNK = 1024  # Number of frames per buffer

# Initialize PyAudio
audio = pyaudio.PyAudio()

# Open a stream
stream = audio.open(format=FORMAT,
                    channels=CHANNELS,
                    rate=RATE,
                    input=True,
                    frames_per_buffer=CHUNK)

print("Recording...")

def get_main_frequency(data, rate):
    # Perform FFT
    fft_data = np.fft.fft(data)
    freqs = np.fft.fftfreq(len(fft_data))

    # Get the magnitude of the FFT
    magnitude = np.abs(fft_data)
    
    # Get the frequency with the highest magnitude
    peak_index = np.argmax(magnitude)
    peak_freq = abs(freqs[peak_index] * rate)
    
    return peak_freq

try:
    while True:
        # Read audio data
        data = np.frombuffer(stream.read(CHUNK), dtype=np.int16)
        
        # Compute the main frequency
        main_freq = get_main_frequency(data, RATE)
        
        print(f"Main Frequency: {main_freq} Hz")

except KeyboardInterrupt:
    print("Recording stopped")

finally:
    # Stop and close the stream
    stream.stop_stream()
    stream.close()
    audio.terminate()

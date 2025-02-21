document.addEventListener('DOMContentLoaded', function() {

    const AUDIO_CONFIG = {
        MP3_BITRATE: 192, // Increased from 128 for better quality
        CHUNK_SIZE: 4096, // Larger chunk size for better performance
        MAX_DURATION: 3600, // Maximum duration in seconds (1 hour)
        SAMPLE_RATE: 44100, // Standard sample rate
    };
    // Elements
    const elements = {
        uploadSection: document.getElementById('uploadSection'),
        audioSection: document.getElementById('audioSection'),
        mediaInput: document.getElementById('mediaInput'),
        audioPlayer: document.getElementById('audioPlayer'),
        startTimeSlider: document.getElementById('startTimeSlider'),
        endTimeSlider: document.getElementById('endTimeSlider'),
        startTimeDisplay: document.getElementById('startTimeDisplay'),
        endTimeDisplay: document.getElementById('endTimeDisplay'),
        selectedStartTime: document.getElementById('selectedStartTime'),
        selectedEndTime: document.getElementById('selectedEndTime'),
        trimButton: document.getElementById('trimButton'),
        trimButtonText: document.getElementById('trimButtonText'),
        trimButtonLoader: document.getElementById('trimButtonLoader'),
        downloadButton: document.getElementById('downloadButton'),
        previewSection: document.getElementById('previewSection'),
        previewPlayer: document.getElementById('previewPlayer')
    };


    let audioContext = null;
    let audioBuffer = null;

    // File input change handler
    elements.mediaInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (isValidAudioFile(file)) {
            handleAudioFile(file);
        }
    });

    // Drag and drop handlers
    elements.uploadSection.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.uploadSection.classList.add('border-indigo-500');
    });

    elements.uploadSection.addEventListener('dragleave', () => {
        elements.uploadSection.classList.remove('border-indigo-500');
    });

    elements.uploadSection.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.uploadSection.classList.remove('border-indigo-500');
        const file = e.dataTransfer.files[0];
        if (isValidAudioFile(file)) {
            handleAudioFile(file);
        }
    });

    // Validate audio file
    function isValidAudioFile(file) {
        const validTypes = ['audio/mp3', 'audio/wav', 'audio/mpeg'];
        const maxSize = 500 * 1024 * 1024; // 500MB max file size

        if (!file) {
            showError('Please select a file');
            return false;
        }
        if (!validTypes.includes(file.type)) {
            showError('Please upload a valid audio file (MP3 or WAV)');
            return false;
        }
        if (file.size > maxSize) {
            showError('File size too large. Maximum size is 500MB');
            return false;
        }
        return true;
    }

    // Set button loading state
    function setButtonLoading(isLoading, message = 'Processing...') {
        // Get elements
        const button = elements.trimButton;
        const loader = elements.trimButtonLoader;
        const text = elements.trimButtonText;

        // Update button state and text
        button.disabled = isLoading;
        text.textContent = isLoading ? message : 'Trim Audio';

        // Show/hide loader
        if (isLoading) {
            loader.classList.remove('hidden');
        } else {
            loader.classList.add('hidden');
        }

        // Update button styles
        button.classList.toggle('opacity-50', isLoading);
        button.classList.toggle('cursor-not-allowed', isLoading);

        // Disable sliders and audio player during processing
        elements.startTimeSlider.disabled = isLoading;
        elements.endTimeSlider.disabled = isLoading;
        elements.audioPlayer.disabled = isLoading;
    }

    // Handle audio file
    async function handleAudioFile(file) {
        try {
            const url = URL.createObjectURL(file);
            elements.audioPlayer.src = url;
            elements.audioSection.classList.remove('hidden');

            setButtonLoading(true, 'Loading audio...');

            // Wait for audio metadata to load
            await new Promise((resolve, reject) => {
                elements.audioPlayer.addEventListener('loadedmetadata', resolve);
                elements.audioPlayer.addEventListener('error', reject);
            });

            const duration = elements.audioPlayer.duration;
            if (duration > AUDIO_CONFIG.MAX_DURATION) {
                throw new Error('Audio file too long. Maximum duration is 1 hour.');
            }

            elements.startTimeSlider.max = duration;
            elements.endTimeSlider.max = duration;
            elements.endTimeSlider.value = duration;
            updateTimeDisplays();

            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)({
                    sampleRate: AUDIO_CONFIG.SAMPLE_RATE
                });
            }

            const arrayBuffer = await file.arrayBuffer();
            audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            setButtonLoading(false);

        } catch (error) {
            console.error('Error loading audio:', error);
            showError('Error loading audio file: ' + error.message);
            setButtonLoading(false);
        }
    }

    // Format time display
    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        const ms = Math.floor((seconds % 1) * 100);
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }

    // Update time displays
    function updateTimeDisplays() {
        const startTime = parseFloat(elements.startTimeSlider.value);
        const endTime = parseFloat(elements.endTimeSlider.value);

        elements.startTimeDisplay.textContent = formatTime(startTime);
        elements.endTimeDisplay.textContent = formatTime(endTime);
        elements.selectedStartTime.textContent = formatTime(startTime);
        elements.selectedEndTime.textContent = formatTime(endTime);
    }

    // Show error message
    function showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4';
        errorDiv.textContent = message;
        elements.uploadSection.parentNode.insertBefore(errorDiv, elements.uploadSection);
        setTimeout(() => errorDiv.remove(), 5000);
    }

    // Show success message
    function showSuccess(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4';
        successDiv.textContent = message;
        elements.uploadSection.parentNode.insertBefore(successDiv, elements.uploadSection);
        setTimeout(() => successDiv.remove(), 5000);
    }

    // Trim button click handler
    elements.trimButton.addEventListener('click', async () => {
        if (!audioBuffer) return;

        const startTime = parseFloat(elements.startTimeSlider.value);
        const endTime = parseFloat(elements.endTimeSlider.value);

        if (startTime >= endTime) {
            showError('Start time must be less than end time');
            return;
        }

        try {
            setButtonLoading(true, 'Preparing...');

            // Clear previous preview if exists
            if (elements.previewPlayer.src) {
                URL.revokeObjectURL(elements.previewPlayer.src);
            }

            const trimmedBuffer = await trimAudio(startTime, endTime);
            const mp3Blob = await convertToMp3(trimmedBuffer);

            elements.previewSection.classList.remove('hidden');
            elements.previewPlayer.src = URL.createObjectURL(mp3Blob);

            elements.downloadButton.classList.remove('hidden');
            elements.downloadButton.onclick = () => downloadAudio(mp3Blob);

            showSuccess('Audio processed successfully!');
        } catch (error) {
            console.error('Error:', error);
            showError('Error processing audio: ' + error.message);
        } finally {
            setButtonLoading(false);
        }
    });

    // Slider event listeners
    elements.startTimeSlider.addEventListener('input', () => {
        const startTime = parseFloat(elements.startTimeSlider.value);
        const endTime = parseFloat(elements.endTimeSlider.value);

        if (startTime >= endTime) {
            elements.startTimeSlider.value = endTime - 1;
        }
        updateTimeDisplays();
    });

    elements.endTimeSlider.addEventListener('input', () => {
        const startTime = parseFloat(elements.startTimeSlider.value);
        const endTime = parseFloat(elements.endTimeSlider.value);

        if (endTime <= startTime) {
            elements.endTimeSlider.value = startTime + 1;
        }
        updateTimeDisplays();
    });

    // Trim audio function
    async function trimAudio(startTime, endTime) {
        const sampleRate = audioBuffer.sampleRate;
        const startOffset = Math.floor(startTime * sampleRate);
        const endOffset = Math.floor(endTime * sampleRate);
        const length = endOffset - startOffset;

        // Process in chunks to avoid memory issues
        const chunkSize = AUDIO_CONFIG.CHUNK_SIZE;
        const trimmedBuffer = audioContext.createBuffer(
            audioBuffer.numberOfChannels,
            length,
            sampleRate
        );

        for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
            const channelData = audioBuffer.getChannelData(channel);
            for (let i = 0; i < length; i += chunkSize) {
                const currentChunkSize = Math.min(chunkSize, length - i);
                const chunk = channelData.slice(startOffset + i, startOffset + i + currentChunkSize);
                trimmedBuffer.copyToChannel(chunk, channel, i);

                // Allow UI to update and prevent blocking
                if (i % (chunkSize * 4) === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                    setButtonLoading(true, `Trimming... ${Math.round((i / length) * 100)}%`);
                }
            }
        }

        return trimmedBuffer;
    }

    // Convert to MP3
    async function convertToMp3(audioBuffer) {
        if (!audioBuffer || !audioBuffer.numberOfChannels) {
            throw new Error('Invalid audio buffer');
        }

        const channels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;

        // Initialize MP3 encoder with better quality settings
        const mp3encoder = new lamejs.Mp3Encoder(
            channels,
            sampleRate,
            AUDIO_CONFIG.MP3_BITRATE
        );

        const mp3Data = [];
        const sampleBlockSize = AUDIO_CONFIG.CHUNK_SIZE;
        const numSamples = audioBuffer.length;
        let processedSamples = 0;

        // Get audio data
        const channelData = [];
        for (let channel = 0; channel < channels; channel++) {
            channelData[channel] = audioBuffer.getChannelData(channel);
        }

        try {
            for (let i = 0; i < numSamples; i += sampleBlockSize) {
                const currentBlockSize = Math.min(sampleBlockSize, numSamples - i);
                const leftInt16 = new Int16Array(currentBlockSize);
                const rightInt16 = channels > 1 ? new Int16Array(currentBlockSize) : null;

                // Convert samples to Int16
                for (let j = 0; j < currentBlockSize; j++) {
                    // Improved conversion with dithering to reduce quantization noise
                    const dither = (Math.random() * 2 - 1) * 0.5;
                    leftInt16[j] = Math.max(-32768, Math.min(32767,
                        Math.round(channelData[0][i + j] * 32767 + dither)));

                    if (channels > 1) {
                        rightInt16[j] = Math.max(-32768, Math.min(32767,
                            Math.round(channelData[1][i + j] * 32767 + dither)));
                    }
                }

                // Encode the block
                const mp3buf = channels > 1
                    ? mp3encoder.encodeBuffer(leftInt16, rightInt16)
                    : mp3encoder.encodeBuffer(leftInt16);

                if (mp3buf && mp3buf.length > 0) {
                    mp3Data.push(mp3buf);
                }

                processedSamples += currentBlockSize;

                // Update progress and allow UI to update
                if (i % (sampleBlockSize * 4) === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                    const progress = Math.round((processedSamples / numSamples) * 100);
                    setButtonLoading(true, `Converting... ${progress}%`);
                }
            }

            const mp3buf = mp3encoder.flush();
            if (mp3buf && mp3buf.length > 0) {
                mp3Data.push(mp3buf);
            }

            return new Blob(mp3Data, { type: 'audio/mp3' });

        } catch (error) {
            console.error('MP3 conversion error:', error);
            throw new Error('Failed to convert audio to MP3: ' + error.message);
        }
    }

    // Add memory cleanup function
    function cleanup() {
        if (audioBuffer) {
            audioBuffer = null;
        }
        if (audioContext && audioContext.state !== 'closed') {
            audioContext.close();
            audioContext = null;
        }
        // Clear any object URLs
        if (elements.audioPlayer.src) {
            URL.revokeObjectURL(elements.audioPlayer.src);
        }
        if (elements.previewPlayer.src) {
            URL.revokeObjectURL(elements.previewPlayer.src);
        }
    }

    // Add window unload handler for cleanup
    window.addEventListener('unload', cleanup);

    // Download audio function
    function downloadAudio(blob) {
        const timestamp = new Date().toISOString()
            .replace(/[:.]/g, '-')
            .slice(0, 19);

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `trimmed-audio-${timestamp}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
});
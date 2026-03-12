// 1. Configuration: The text to speak for each field
const guideData = {
    // Replace these IDs with the actual IDs from your HTML code
    "nameInput": {
        "en-IN": "Please enter your full name here.",
        "hi-IN": "कृपया यहाँ अपना पूरा नाम दर्ज करें।",
        "mr-IN": "कृपया इथे तुमचे पूर्ण नाव लिहा."
    },
    "locationInput": {
        "en-IN": "Enter the location or address of the issue.",
        "hi-IN": "समस्या का पता या स्थान यहाँ लिखें।",
        "mr-IN": "समस्येचा पत्ता किंवा स्थान येथे लिहा."
    },
    "issueInput": { // Assuming this is your description textarea
        "en-IN": "Describe your issue in detail here.",
        "hi-IN": "अपनी समस्या का विवरण यहाँ लिखें।",
        "mr-IN": "इथे तुमचा इश्यू सांगा." // "Hiithe tumcha issue sangha"
    },
    "imageInput": {
        "en-IN": "Upload a photo of the issue if available.",
        "hi-IN": "समस्या की फोटो अपलोड करें।",
        "mr-IN": "समस्येचा फोटो अपलोड करा."
    },
    "categorySelect": {
        "en-IN": "Select the type of issue, for example, road, water, or garbage.",
        "hi-IN": "समस्या का प्रकार चुनें, जैसे सड़क, पानी, या कचरा।",
        "mr-IN": "समस्येचा प्रकार निवडा, उदाहरणार्थ रस्ता, पाणी किंवा कचरा."
    }
};

// 2. State Variables
let currentLang = 'en-IN';
let voiceEnabled = true;

// 3. Functions
function updateLanguage() {
    const select = document.getElementById('voiceLang');
    currentLang = select.value;
}

function toggleVoice() {
    voiceEnabled = !voiceEnabled;
    const btn = document.getElementById('voiceToggleBtn');
    if (voiceEnabled) {
        btn.innerHTML = "🔊 Voice On";
        btn.style.backgroundColor = "#4CAF50";
    } else {
        btn.innerHTML = "🔇 Voice Off";
        btn.style.backgroundColor = "#f44336";
    }
}

function speakText(text) {
    if (!voiceEnabled) return;

    // Cancel any ongoing speech to prevent overlap
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set the language
    utterance.lang = currentLang;
    
    // Optional: Set pitch and speed for a more natural feel
    utterance.pitch = 1; 
    utterance.rate = 0.9; // Slightly slower for clarity

    // Find a voice that matches the language (optional but recommended)
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.lang === currentLang);
    if (voice) {
        utterance.voice = voice;
    }

    window.speechSynthesis.speak(utterance);
}

// 4. Initialize Event Listeners
// We wait for the page to load to attach events
document.addEventListener('DOMContentLoaded', function() {
    
    // Get all input/select/textarea elements you want to guide
    // You should add a specific class to them in HTML, e.g., class="voice-guide"
    // OR you can target them by ID directly as shown below:
    
    const fieldsToGuide = document.querySelectorAll('input, textarea, select');

    fieldsToGuide.forEach(field => {
        // We check if we have guide data for this field's ID
        if (guideData[field.id]) {
            field.addEventListener('focus', function() {
                const text = guideData[field.id][currentLang];
                speakText(text);
            });
        }
    });

    // Chrome requires this workaround to load voices sometimes
    if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => {};
    }
});
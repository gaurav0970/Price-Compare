


// DOM Elements
const searchInput = document.getElementById('search-input');
const searchButton = document.getElementById('search-button');
const resultsSection = document.getElementById('results-section');
const locationText = document.getElementById('location-text');
const refreshLocationBtn = document.getElementById('refresh-location');
const loadingOverlay = document.getElementById('loading-overlay');
const lastUpdatedSpan = document.getElementById('last-updated');
const chatbotToggle = document.getElementById("chatbotToggle");
const chatbotContainer = document.getElementById("chatbot");
const minimizeBtn = document.getElementById("minimizeChatbot");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.getElementById("chat-messages");

// Global variables
let products = [];
let lastUpdated = new Date().toISOString().split('T')[0]; // Current date as YYYY-MM-DD

// Initialize the app
document.addEventListener('DOMContentLoaded', function () {
    lastUpdatedSpan.textContent = lastUpdated;
    searchButton.addEventListener('click', handleSearch);
    searchInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    refreshLocationBtn.addEventListener('click', detectLocation);
    detectLocation(); // Auto-detect location
    checkAuthStatus();
});

// Function to sort platforms by price
function sortPlatformsByPrice(platforms) {
    return Object.entries(platforms)
        .filter(([_, info]) => info && typeof info.price === 'number')
        .sort(([_, infoA], [__, infoB]) => infoA.price - infoB.price)
        .reduce((sorted, [platform, info]) => {
            sorted[platform] = info;
            return sorted;
        }, {});
}

chatbotToggle.addEventListener("click", () => {
    chatbotContainer.classList.remove("hidden");
    chatbotToggle.classList.add("hidden");
});

minimizeBtn.addEventListener("click", () => {
    chatbotContainer.classList.add("hidden");
    chatbotToggle.classList.remove("hidden");
});
// Handle search and fetch from Flask backend
async function handleSearch() {
    const query = searchInput.value.trim();
    if (!query) {
        alert('Please enter a product name!');
        return;
    }

    resultsSection.innerHTML = '';
    loadingOverlay.style.display = 'flex';

    try {
        const response = await fetch(`http://127.0.0.1:5000/api/products?product=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (data.error) {
            resultsSection.innerHTML = `<p class="error">${data.error}</p>`;
        } else {
            // Sort platforms by price before displaying
            if (data.direct_links) {
                data.direct_links = sortPlatformsByPrice(data.direct_links);
            }
            displayResults(data);
        }
    } catch (err) {
        console.error('Fetch error:', err);
        resultsSection.innerHTML = `<p class="error">Failed to fetch results. Please try again later.</p>`;
    } finally {
        loadingOverlay.style.display = 'none';
    }
}

// Function to display product results
// Function to extract quantity from product title

function extractQuantity(title) {
    // Common patterns for quantities
    const patterns = [
        /(\d+)\s*ml/i,         // For milliliters
        /(\d+)\s*l(iter)?/i,   // For liters
        /(\d+)\s*g(ram)?/i,    // For grams
        /(\d+)\s*kg/i,         // For kilograms
        /(\d+)\s*pcs/i,        // For pieces
        /(\d+)\s*pack/i        // For packs
    ];
    
    for (const pattern of patterns) {
        const match = title.match(pattern);
        if (match) {
            const amount = parseInt(match[1]);
            const unit = match[0].replace(amount, '').trim().toLowerCase();
            
            return {
                amount,
                unit,
                normalized: normalizeQuantity(amount, unit)
            };
        }
    }
    
    // Default if no quantity found
    return null;
}

// Normalize quantity to a standard unit
function normalizeQuantity(amount, unit) {
    // Convert to base units (ml for liquids, g for weight)
    if (unit.includes('l') && !unit.includes('ml')) {
        return { value: amount * 1000, unit: 'ml' };
    } else if (unit.includes('kg')) {
        return { value: amount * 1000, unit: 'g' };
    }
    
    // Already in base units or unknown format
    return { value: amount, unit: unit.replace(/[^a-z]/g, '') };
}

// Calculate unit price (price per standard unit)
function calculateUnitPrice(price, quantity) {
    if (!quantity) return null;
    
    const { value, unit } = quantity.normalized;
    if (!value) return null;
    
    return {
        price: price / value,
        unit: unit
    };
}

// Enhanced display function with unit price comparison
function displayResults(data) {
    const resultsSection = document.querySelector(".results");
    resultsSection.innerHTML = ""; // Clear previous results

    const productCard = document.createElement("div");
    productCard.className = "product-card visible";

    // Header
    const productHeader = document.createElement("div");
    productHeader.className = "product-header";
    productHeader.innerHTML = `
        <div class="product-name">${data.product}</div>
        <div class="product-category">Price Comparison</div>
    `;

    // Platform links
    const priceComparison = document.createElement("div");
    priceComparison.className = "price-comparison";

    const platforms = data.direct_links || {};
    
    // Extract quantities and calculate unit prices
    let platformsWithUnitPrices = [];
    
    for (const [platform, info] of Object.entries(platforms)) {
        if (!info || typeof info.price !== 'number') continue;
        
        const quantity = extractQuantity(info.name);
        const unitPrice = calculateUnitPrice(info.price, quantity);
        
        platformsWithUnitPrices.push({
            platform,
            info,
            quantity,
            unitPrice,
            originalPrice: info.price
        });
    }
    
    // Sort by unit price if available, otherwise by original price
    platformsWithUnitPrices.sort((a, b) => {
        if (a.unitPrice && b.unitPrice && a.unitPrice.unit === b.unitPrice.unit) {
            return a.unitPrice.price - b.unitPrice.price;
        }
        return a.originalPrice - b.originalPrice;
    });
    
    // Find best unit price
    let bestUnitPricePlatform = null;
    if (platformsWithUnitPrices.length > 0 && 
        platformsWithUnitPrices[0].unitPrice) {
        bestUnitPricePlatform = platformsWithUnitPrices[0].platform;
    }
    
    // Add summary section if we have multiple prices
    if (platformsWithUnitPrices.length > 0) {
        const bestOption = platformsWithUnitPrices[0];
        
        const summarySavings = document.createElement("div");
        summarySavings.className = "price-summary";
        
        let summaryText = '';
        if (bestOption.unitPrice) {
            summaryText = `
                <div class="savings-info">
                    <i class="fas fa-tags"></i> 
                    Best value on <strong>${bestOption.platform}</strong>: 
                    ₹${bestOption.originalPrice} for ${bestOption.quantity.amount}${bestOption.quantity.unit}
                    (₹${bestOption.unitPrice.price.toFixed(2)} per ${bestOption.unitPrice.unit})
                </div>
            `;
        } else {
            summaryText = `
                <div class="savings-info">
                    <i class="fas fa-tags"></i> 
                    Lowest price found on <strong>${bestOption.platform}</strong> at ₹${bestOption.originalPrice}
                </div>
            `;
        }
        
        summarySavings.innerHTML = summaryText;
        productCard.appendChild(summarySavings);
    }

    // Display each platform's products
    for (const item of platformsWithUnitPrices) {
        const { platform, info, quantity, unitPrice, originalPrice } = item;
        
        const priceItem = document.createElement("div");
        priceItem.className = "price-item";
        
        // Determine if this is the best value
        const isBestValue = (platform === bestUnitPricePlatform);
        
        // Format the price display
        let priceDisplay = `₹${originalPrice}`;
        let quantityDisplay = '';
        let unitPriceDisplay = '';
        
        if (quantity) {
            quantityDisplay = `<div class="quantity-info">${quantity.amount}${quantity.unit}</div>`;
        }
        
        if (unitPrice) {
            unitPriceDisplay = `<div class="unit-price">₹${unitPrice.price.toFixed(2)} per ${unitPrice.unit}</div>`;
        }
        
        if (isBestValue) {
            priceDisplay += ' <span class="best-price-label">Best Value!</span>';
        }

        // Estimate delivery time
        const deliveryTime = getEstimatedDeliveryTime(platform);

        priceItem.innerHTML = `
            <div class="price-platform">
                <img src="images/${platform.toLowerCase()}.png" alt="${platform}" style="height:24px;"> 
                <strong>${platform}</strong>
                <div class="delivery-time"><i class="fas fa-clock"></i> ${deliveryTime}</div>
            </div>
            <div class="price-details">
                <div class="price-amount ${isBestValue ? 'best-price' : ''}">${priceDisplay}</div>
                ${quantityDisplay}
                ${unitPriceDisplay}
            </div>
            <a class="view-product" href="${info.url}" target="_blank">
                <i class="fas fa-shopping-cart"></i> Buy Now
            </a>
        `;

        priceComparison.appendChild(priceItem);
    }

    productCard.appendChild(productHeader);
    productCard.appendChild(priceComparison);
    resultsSection.appendChild(productCard);
}

// Helper function to get estimated delivery time (placeholder data)
function getEstimatedDeliveryTime(platform) {
    const times = {
        'Blinkit': '10-15 min',
        'Zepto': '10 min',
        'Instamart': '15-20 min',
        'JioMart': '2 hours',
        'Dmart Ready': '2-3 hours',
        'Flipkart Minutes': '60-90 min'
    };
    
    return times[platform] || '30-60 min';
}


function renderResults(data) {
    const resultsContainer = document.querySelector('.results');
    resultsContainer.innerHTML = ''; // Clear old

    const productCard = document.createElement('div');
    productCard.classList.add('product-card', 'visible');

    const header = document.createElement('div');
    header.classList.add('product-header');

    header.innerHTML = `
        <div class="product-name">${data.product}</div>
        <div class="product-category">Search Result</div>
    `;

    const priceComparison = document.createElement('div');
    priceComparison.classList.add('price-comparison');

    const platforms = ['Blinkit', 'Zepto', 'Instamart'];
    platforms.forEach(platform => {
        const platformData = data.direct_links[platform];

        const priceItem = document.createElement('div');
        priceItem.classList.add('price-item');

        if (platformData) {
            priceItem.innerHTML = `
                <div class="price-platform">
                    <img src="images/${platform.toLowerCase()}.png" alt="${platform}" style="height:24px; border-radius:50%;">
                    <strong>${platform}</strong>
                </div>
                <div class="price-amount">See Price</div>
                <a href="${platformData.url}" target="_blank" class="view-product">Buy Now</a>
            `;
        } else {
            priceItem.innerHTML = `
                <div class="price-platform">
                    <img src="images/${platform.toLowerCase()}.png" alt="${platform}" style="height:24px; border-radius:50%;">
                    <strong>${platform}</strong>
                </div>
                <div class="price-difference">No product found</div>
            `;
        }

        priceComparison.appendChild(priceItem);
    });

    productCard.appendChild(header);
    productCard.appendChild(priceComparison);
    resultsContainer.appendChild(productCard);
}


// Location functions
function detectLocation() {
    showLoading(true);
    locationText.textContent = 'Detecting your precise location...';

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                reverseGeocodeWithFullAddress(position.coords.latitude, position.coords.longitude);
            },
            (error) => {
                showLoading(false);
                handleLocationError(error);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    } else {
        showLoading(false);
        locationText.textContent = 'Geolocation not supported by your browser.';
    }
}

function reverseGeocodeWithFullAddress(lat, lng) {
    fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`)
        .then(res => res.json())
        .then(data => {
            const address = data.address;
            const fullAddress = buildFullAddress(address);
            locationText.textContent = `Delivering to: ${fullAddress}`;

            // Save to local storage
            localStorage.setItem('lastKnownLat', lat);
            localStorage.setItem('lastKnownLng', lng);
            localStorage.setItem('lastKnownAddress', fullAddress);
        })
        .catch(err => {
            console.error('Reverse geocoding error:', err);
            locationText.textContent = 'Unable to detect location.';
        })
        .finally(() => {
            showLoading(false);
        });
}

function buildFullAddress(address) {
    if (!address) return 'your location';
    let parts = [];

    if (address.house_number && address.road) {
        parts.push(`${address.house_number} ${address.road}`);
    } else if (address.road) {
        parts.push(address.road);
    }

    if (address.neighbourhood) {
        parts.push(address.neighbourhood);
    } else if (address.suburb) {
        parts.push(address.suburb);
    }

    if (address.city) {
        parts.push(address.city);
    } else if (address.town) {
        parts.push(address.town);
    } else if (address.village) {
        parts.push(address.village);
    }

    if (address.state) parts.push(address.state);
    if (address.postcode) parts.push(address.postcode);
    if (address.country && address.country !== 'India') parts.push(address.country);

    return parts.join(', ');
}

function handleLocationError(error) {
    console.error('Location error:', error);
    const lastLat = localStorage.getItem('lastKnownLat');
    const lastLng = localStorage.getItem('lastKnownLng');
    const lastAddress = localStorage.getItem('lastKnownAddress');

    if (lastLat && lastLng) {
        locationText.textContent = lastAddress
            ? `Delivering to: ${lastAddress}`
            : `Near coordinates: ${lastLat}, ${lastLng}`;
        return;
    }

    switch (error.code) {
        case error.PERMISSION_DENIED:
        case error.POSITION_UNAVAILABLE:
        case error.TIMEOUT:
        default:
            locationText.textContent = 'Using approximate location...';
            fetchIPBasedLocation();
    }
}

function fetchIPBasedLocation() {
    fetch('https://ipapi.co/json/')
        .then(res => res.json())
        .then(data => {
            let parts = [data.city, data.region, data.country_name].filter(Boolean);
            locationText.textContent = parts.length > 0
                ? `Approximate location: ${parts.join(', ')}`
                : 'Location unavailable';
        })
        .catch(err => {
            console.error('IP location error:', err);
            locationText.textContent = 'Location unavailable';
        });
}

function showLoading(show) {
    loadingOverlay.style.display = show ? 'flex' : 'none';
}

// Authentication
function checkAuthStatus() {
    const token = localStorage.getItem('token');
    const authButtons = document.getElementById('authButtons');
    const userProfile = document.getElementById('userProfile');

    if (token) {
        authButtons.style.display = 'none';
        userProfile.style.display = 'flex';

        fetch('http://localhost:3000/api/user', {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => res.json())
            .then(data => {
                if (data.name) {
                    document.getElementById('userName').textContent = data.name;
                }
            })
            .catch(err => {
                console.error('User fetch error:', err);
            });
    } else {
        authButtons.style.display = 'flex';
        userProfile.style.display = 'none';
    }
}

document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('token');
    checkAuthStatus();
    window.location.href = 'index.html';
});



chatInput.addEventListener("keypress", async (e) => {
    if (e.key === "Enter" && chatInput.value.trim() !== "") {
        const message = chatInput.value.trim();
        chatInput.value = "";

        // Show user message
        addMessage("You", message);

        // Send to Flask chatbot endpoint
        try {
            const res = await fetch("http://127.0.0.1:5000/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message })
            });

            const data = await res.json();
            addMessage("Bot", data.response);
        } catch (err) {
            addMessage("Bot", "⚠️ Sorry, I couldn't process that right now.");
            console.error(err);
        }
    }
});

function addMessage(sender, text) {
    const msg = document.createElement("div");
    msg.innerHTML = `<strong>${sender}:</strong> ${text.replace(/\n/g, "<br>")}`;
    chatMessages.appendChild(msg);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

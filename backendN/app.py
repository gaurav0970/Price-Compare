import requests
from flask import Flask, jsonify, request
from flask_cors import CORS
import json
import re
from flask import make_response
from flask_cors import CORS, cross_origin
from collections import defaultdict

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

SERPAPI_KEY = "35cddf5c29bf017dd4d9ed417d0bb269b6ca03b4d62ad2dc13b2f3903d2745e4"  # Replace with your actual key

from urllib.parse import quote_plus

def get_store_links(product_name):
    encoded = quote_plus(product_name.strip())
    return {
        "Blinkit": f"https://blinkit.com/s/?q={encoded}",
        "Zepto": f"https://www.zeptonow.com/search?q={encoded}",
        "Instamart": f"https://www.instamart.com/search/{encoded}",
        "Dmart Ready": f"https://www.dmart.in/search/{encoded}",
        "JioMart": f"https://www.jiomart.com/catalogsearch/result?q={encoded}",
        "Flipkart Minutes": f"https://www.flipkart.com/search?q={encoded}",
        "BigBasket": f"https://www.bigbasket.com/ps/?q={encoded}"
    }

def fetch_direct_product_links(product_name):
    search_query = f"{product_name} site:blinkit.com OR site:zeptonow.com OR site:swiggy.com OR site:dmart.in OR site:jiomart.com OR site:flipkart.com OR site:bigbasket.com"
    url = f"https://serpapi.com/search.json?q={search_query}&api_key={SERPAPI_KEY}"

    response = requests.get(url)
    
    platforms = defaultdict(list)  # Allow multiple items per platform

    if response.status_code == 200:
        data = response.json()
        results = data.get("organic_results", [])

        for result in results:
            link = result.get("link")
            title = result.get("title", product_name)
            snippet = result.get("snippet", "")

            price = "Price not available"

            rich_snippet = result.get("rich_snippet", {})
            if 'bottom' in rich_snippet and 'detected_extensions' in rich_snippet['bottom']:
                detected_extensions = rich_snippet['bottom']['detected_extensions']
                if 'price' in detected_extensions:
                    price = detected_extensions['price']

            if price == "Price not available":
                price_match = re.search(r'₹(\d+(\.\d+)?)', title + snippet)
                if price_match:
                    price = float(price_match.group(1))
                else:
                    continue  # Skip if price cannot be determined

            platform = None
            if "blinkit.com" in link:
                platform = "Blinkit"
            elif "zeptonow.com" in link:
                platform = "Zepto"
            elif "swiggy.com" in link:
                platform = "Instamart"
            elif "dmart.in" in link:
                platform = "Dmart Ready"
            elif "jiomart.com" in link:
                platform = "JioMart"
            elif "flipkart.com" in link:
                platform = "Flipkart Minutes"
            elif "bigbasket.com" in link:
                platform = "BigBasket"

            if platform:
                platforms[platform].append({
                    "url": link,
                    "name": title,
                    "price": price
                })

                

    return platforms

def extract_product_from_message(message):
    message = message.lower()
    message = re.sub(r'[^\w\s]', '', message)
    message = ' '.join(message.split())
    
    remove_phrases = [
        'tell me about the', 'tell me about', 'what is the', 'what is',
        'how much is the', 'how much is', 'price of the', 'price of',
        'cost of the', 'cost of', 'show me', 'find me',
        'compare', 'buy', 'purchase', 'product', 'is it', 'should i buy', 'worth it'
    ]
    
    for phrase in remove_phrases:
        if phrase in message:
            message = message.replace(phrase, '')
    
    return message.strip()

def parse_chat_message(message):
    message = message.lower().strip()

    # Detect "under ₹X" or "below ₹X"
    price_limit_match = re.search(r'(under|below|less than)\s*₹?\s*(\d+)', message)
    price_limit = int(price_limit_match.group(2)) if price_limit_match else None

    # Detect "compare A and B" or "which is cheaper: A or B"
    if ' vs ' in message or ' or ' in message or 'compare' in message or 'cheaper' in message:
        products = re.split(r'vs| or |compare|cheaper than', message)
        products = [p.strip() for p in products if p.strip()]
        return {"mode": "compare", "products": products, "price_limit": price_limit}

    # Default: single product search
    message = re.sub(r'[^\w\s₹]', '', message)
    remove_phrases = ['find', 'show', 'buy', 'get', 'price of', 'cost of', 'how much is']
    for phrase in remove_phrases:
        message = message.replace(phrase, '')

    return {"mode": "single", "products": [message.strip()], "price_limit": price_limit}



@app.route('/api/products', methods=['GET'])
def get_products():
    product_query = request.args.get('product')
    print("line 44 ",product_query)
    if not product_query:
        return jsonify({"error": "No product name provided."}), 400

    store_links = get_store_links(product_query)
    direct_links = fetch_direct_product_links(product_query)

    return jsonify({
        "product": product_query,
        "store_links": store_links,
        "direct_links": direct_links or {}
    })


@app.route('/api/chat', methods=['POST'])
def chat_bot():
    data = request.json
    user_message = data.get("message", "").strip()

    if not user_message:
        return jsonify({"response": "Please ask about a product."})

    parsed = parse_chat_message(user_message)
    mode = parsed['mode']
    products = parsed['products']
    limit = parsed['price_limit']

    response_lines = []

    if mode == "compare" and len(products) >= 2:
        comparisons = []

        for product in products:
            links = fetch_direct_product_links(product)
            best_price = float('inf')
            best_info = None

            for platform, items in links.items():
                for item in items:
                    try:
                        price = float(str(item['price']).replace('₹', '').strip())
                        if limit is None or price <= limit:
                            if price < best_price:
                                best_price = price
                                best_info = item | {"platform": platform}
                    except:
                        continue

            if best_info:
                comparisons.append(f"🛒 **{best_info['name']}** on *{best_info['platform']}* for ₹{best_price}")
            else:
                comparisons.append(f"No available listings found for **{product}**")

        response = "🆚 **Product Comparison:**\n" + "\n".join(comparisons)

    elif mode == "single":
        product = products[0]
        links = fetch_direct_product_links(product)
        entries = []

        for platform, items in links.items():
            for item in items:
                try:
                    price = float(str(item['price']).replace('₹', '').strip())
                    if limit is None or price <= limit:
                        entries.append({
                            "platform": platform,
                            "name": item['name'],
                            "price": price,
                            "url": item['url']
                        })
                except:
                    continue

        if not entries:
            response = f"❌ No results found for **{product}**"
        else:
            entries.sort(key=lambda x: x['price'])
            top = entries[0]
            response_lines.append(f"💸 **Lowest Price:** ₹{top['price']} on *{top['platform']}*")
            response_lines += [f"• {e['name']} – ₹{e['price']} on {e['platform']}" for e in entries[1:3]]
            if limit:
                response_lines.insert(0, f"🎯 Products under ₹{limit}:")
            response = "\n".join(response_lines)

    else:
        response = "Sorry, I couldn't understand your query."

    return jsonify({"response": response})


if __name__ == "__main__":
    app.run(debug=True, port=5000)

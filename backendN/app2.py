from flask import Flask
app = Flask(__name__)

@app.route('/')
def home():
    return "Flask is running!"

@app.route('/api/chat', methods=['POST'])
def chat():
    return {"status": "success", "message": "API working"}

if __name__ == '__main__':
    app.run(debug=True, port=5000)
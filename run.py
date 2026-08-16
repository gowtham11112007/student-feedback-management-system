import os
from flask import send_from_directory, request, jsonify
from api.index import app

# Path to public static directory
PUBLIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'public')

@app.route('/', defaults={'path': 'index.html'})
@app.route('/<path:path>')
def serve_static(path):
    # Don't serve API routes as static files
    if path.startswith('api/'):
        return jsonify({'error': 'API endpoint not found'}), 404
        
    full_path = os.path.join(PUBLIC_DIR, path)
    if os.path.exists(full_path) and os.path.isfile(full_path):
        return send_from_directory(PUBLIC_DIR, path)
    elif path == 'admin':
        return send_from_directory(PUBLIC_DIR, 'admin.html')
    else:
        # Fallback to index.html for SPA-style routing if needed
        return send_from_directory(PUBLIC_DIR, 'index.html')

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"\n========================================================")
    print(f"  Student Feedback Management System is running!")
    print(f"  Public Feedback Form : http://127.0.0.1:{port}/")
    print(f"  Admin Dashboard      : http://127.0.0.1:{port}/admin.html")
    print(f"  API Health Check     : http://127.0.0.1:{port}/api/health")
    print(f"========================================================\n")
    app.run(host='0.0.0.0', port=port, debug=True)

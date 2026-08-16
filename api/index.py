import os
import jwt
from datetime import datetime, timedelta
from functools import wraps
from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Environment Configurations
SECRET_KEY = os.environ.get('SECRET_KEY', 'default-feedback-secret-key-2026')
ADMIN_USERNAME = os.environ.get('ADMIN_USERNAME', 'admin')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'admin123')

app.config['SECRET_KEY'] = SECRET_KEY

# Database Setup - use /tmp/feedback.db on Vercel or local fallback
db_url = os.environ.get('DATABASE_URL')
if not db_url:
    if os.environ.get('VERCEL') or not os.access('.', os.W_OK):
        db_path = '/tmp/feedback.db'
    else:
        db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'feedback.db')
    db_url = f'sqlite:///{db_path}'

app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Database Models
class Feedback(db.Model):
    __tablename__ = 'feedback'
    
    id = db.Column(db.Integer, primary_key=True)
    student_name = db.Column(db.String(100), nullable=False)
    roll_number = db.Column(db.String(50), nullable=False)
    department = db.Column(db.String(100), nullable=False)
    course_name = db.Column(db.String(100), nullable=False)
    feedback_type = db.Column(db.String(50), nullable=False)
    rating = db.Column(db.Integer, nullable=False)
    message = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(20), default='Pending') # 'Pending' or 'Reviewed'
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'student_name': self.student_name,
            'roll_number': self.roll_number,
            'department': self.department,
            'course_name': self.course_name,
            'feedback_type': self.feedback_type,
            'rating': self.rating,
            'message': self.message,
            'status': self.status,
            'created_at': self.created_at.strftime('%Y-%m-%d %H:%M:%S') if self.created_at else None
        }

# JWT Admin Authorization Decorator
def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        auth_header = request.headers.get('Authorization')
        
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            
        if not token:
            return jsonify({'error': 'Authorization token is missing'}), 401
            
        try:
            payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
            if payload.get('sub') != ADMIN_USERNAME:
                return jsonify({'error': 'Invalid token payload'}), 401
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired. Please log in again.'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401

        return f(*args, **kwargs)
    return decorated

# Helper to initialize DB and seed initial sample data if empty
def seed_sample_data():
    if Feedback.query.count() == 0:
        sample_entries = [
            Feedback(
                student_name="Alex Morgan",
                roll_number="CS2023001",
                department="Computer Science",
                course_name="Data Structures & Algorithms",
                feedback_type="Teaching",
                rating=5,
                message="Professor explained complex graph algorithms with clear visualization and interactive coding examples. Outstanding class!",
                status="Reviewed",
                created_at=datetime.utcnow() - timedelta(days=5)
            ),
            Feedback(
                student_name="Sophia Chen",
                roll_number="ECE2023042",
                department="Electrical Engineering",
                course_name="Digital Signal Processing",
                feedback_type="Facilities",
                rating=3,
                message="Lab equipment in room 302 needs recalibration. Oscilloscopes occasionally freeze during signal sampling experiments.",
                status="Pending",
                created_at=datetime.utcnow() - timedelta(days=4)
            ),
            Feedback(
                student_name="Marcus Vance",
                roll_number="ME2023018",
                department="Mechanical Engineering",
                course_name="Thermodynamics II",
                feedback_type="Curriculum",
                rating=4,
                message="Syllabus is very comprehensive, but adding a practical project on renewable thermal energy systems would make it even better.",
                status="Reviewed",
                created_at=datetime.utcnow() - timedelta(days=3)
            ),
            Feedback(
                student_name="Emma Watson",
                roll_number="CS2023089",
                department="Computer Science",
                course_name="Database Management Systems",
                feedback_type="Teaching",
                rating=5,
                message="Great hands-on SQL workshops! The practical exercises on query optimization were immensely helpful.",
                status="Pending",
                created_at=datetime.utcnow() - timedelta(days=2)
            ),
            Feedback(
                student_name="David Miller",
                roll_number="CE2023005",
                department="Civil Engineering",
                course_name="Structural Mechanics",
                feedback_type="Other",
                rating=2,
                message="Course pace was extremely fast before midterms, and slide decks were uploaded very late prior to examinations.",
                status="Pending",
                created_at=datetime.utcnow() - timedelta(days=1)
            ),
            Feedback(
                student_name="Priya Patel",
                roll_number="BUS2023011",
                department="Business Administration",
                course_name="Financial Accounting",
                feedback_type="Teaching",
                rating=5,
                message="Case study approach helped bridge theoretical accounting standards with real corporate balance sheets. Highly recommend!",
                status="Reviewed",
                created_at=datetime.utcnow()
            )
        ]
        db.session.bulk_save_objects(sample_entries)
        db.session.commit()

with app.app_context():
    db.create_all()
    try:
        seed_sample_data()
    except Exception as e:
        db.session.rollback()
        print("Data seeding note:", e)

# Routes

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'service': 'Student Feedback API'}), 200

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
        expiration = datetime.utcnow() + timedelta(hours=24)
        token = jwt.encode(
            {
                'sub': username,
                'exp': expiration,
                'iat': datetime.utcnow()
            },
            app.config['SECRET_KEY'],
            algorithm='HS256'
        )
        return jsonify({
            'message': 'Login successful',
            'token': token,
            'username': username,
            'expires_at': expiration.isoformat()
        }), 200

    return jsonify({'error': 'Invalid username or password'}), 401

@app.route('/api/feedback', methods=['POST'])
def submit_feedback():
    data = request.get_json() or {}
    
    student_name = data.get('student_name', '').strip()
    roll_number = data.get('roll_number', '').strip()
    department = data.get('department', '').strip()
    course_name = data.get('course_name', '').strip()
    feedback_type = data.get('feedback_type', '').strip()
    rating = data.get('rating')
    message = data.get('message', '').strip()

    # Validation
    errors = []
    if not student_name:
        errors.append('Student name is required.')
    if not roll_number:
        errors.append('Roll number is required.')
    if not department:
        errors.append('Department is required.')
    if not course_name:
        errors.append('Course/Subject name is required.')
    if not feedback_type:
        errors.append('Feedback type is required.')
    if rating is None or not isinstance(rating, int) or rating < 1 or rating > 5:
        errors.append('Rating must be an integer between 1 and 5.')
    if not message or len(message) < 5:
        errors.append('Feedback message must be at least 5 characters long.')

    if errors:
        return jsonify({'error': 'Validation failed', 'details': errors}), 400

    try:
        new_feedback = Feedback(
            student_name=student_name,
            roll_number=roll_number,
            department=department,
            course_name=course_name,
            feedback_type=feedback_type,
            rating=rating,
            message=message,
            status='Pending',
            created_at=datetime.utcnow()
        )
        db.session.add(new_feedback)
        db.session.commit()

        return jsonify({
            'message': 'Feedback submitted successfully! Thank you for your response.',
            'feedback': new_feedback.to_dict()
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to save feedback: {str(e)}'}), 500

@app.route('/api/feedback', methods=['GET'])
@admin_required
def list_feedback():
    query = Feedback.query

    # Search filter (matches student_name, roll_number, course_name, or message)
    q = request.args.get('q', '').strip()
    if q:
        search_pattern = f"%{q}%"
        query = query.filter(
            (Feedback.student_name.ilike(search_pattern)) |
            (Feedback.roll_number.ilike(search_pattern)) |
            (Feedback.course_name.ilike(search_pattern)) |
            (Feedback.message.ilike(search_pattern))
        )

    # Department filter
    dept = request.args.get('department', '').strip()
    if dept and dept != 'all':
        query = query.filter(Feedback.department == dept)

    # Feedback Type filter
    fb_type = request.args.get('feedback_type', '').strip()
    if fb_type and fb_type != 'all':
        query = query.filter(Feedback.feedback_type == fb_type)

    # Rating filter
    rating = request.args.get('rating', '').strip()
    if rating and rating != 'all':
        try:
            query = query.filter(Feedback.rating == int(rating))
        except ValueError:
            pass

    # Status filter
    status = request.args.get('status', '').strip()
    if status and status != 'all':
        query = query.filter(Feedback.status == status)

    # Sort
    sort_by = request.args.get('sort_by', 'created_at')
    order = request.args.get('order', 'desc')

    if sort_by == 'rating':
        column = Feedback.rating
    elif sort_by == 'student_name':
        column = Feedback.student_name
    else:
        column = Feedback.created_at

    if order == 'asc':
        query = query.order_by(column.asc())
    else:
        query = query.order_by(column.desc())

    feedbacks = query.all()
    return jsonify({
        'count': len(feedbacks),
        'feedbacks': [item.to_dict() for item in feedbacks]
    }), 200

@app.route('/api/feedback/<int:feedback_id>', methods=['GET'])
@admin_required
def get_feedback(feedback_id):
    item = Feedback.query.get(feedback_id)
    if not item:
        return jsonify({'error': 'Feedback not found'}), 404
    return jsonify(item.to_dict()), 200

@app.route('/api/feedback/<int:feedback_id>', methods=['PUT'])
@admin_required
def update_feedback_status(feedback_id):
    item = Feedback.query.get(feedback_id)
    if not item:
        return jsonify({'error': 'Feedback not found'}), 404

    data = request.get_json() or {}
    new_status = data.get('status')
    
    if new_status not in ['Reviewed', 'Pending']:
        return jsonify({'error': 'Status must be "Reviewed" or "Pending"'}), 400

    item.status = new_status
    db.session.commit()

    return jsonify({
        'message': f'Feedback marked as {new_status}',
        'feedback': item.to_dict()
    }), 200

@app.route('/api/feedback/<int:feedback_id>', methods=['DELETE'])
@admin_required
def delete_feedback(feedback_id):
    item = Feedback.query.get(feedback_id)
    if not item:
        return jsonify({'error': 'Feedback not found'}), 404

    db.session.delete(item)
    db.session.commit()

    return jsonify({'message': f'Feedback #{feedback_id} deleted successfully'}), 200

@app.route('/api/stats', methods=['GET'])
@admin_required
def get_stats():
    all_feedback = Feedback.query.all()
    total_count = len(all_feedback)

    if total_count == 0:
        return jsonify({
            'total_count': 0,
            'reviewed_count': 0,
            'pending_count': 0,
            'overall_avg_rating': 0,
            'by_department': [],
            'by_type': [],
            'rating_distribution': {'1': 0, '2': 0, '3': 0, '4': 0, '5': 0}
        }), 200

    reviewed_count = sum(1 for f in all_feedback if f.status == 'Reviewed')
    pending_count = total_count - reviewed_count
    overall_avg_rating = round(sum(f.rating for f in all_feedback) / total_count, 2)

    # Department breakdown
    dept_map = {}
    for f in all_feedback:
        if f.department not in dept_map:
            dept_map[f.department] = {'ratings': [], 'count': 0}
        dept_map[f.department]['ratings'].append(f.rating)
        dept_map[f.department]['count'] += 1

    by_department = []
    for dept, data in dept_map.items():
        avg = round(sum(data['ratings']) / len(data['ratings']), 2)
        by_department.append({
            'department': dept,
            'count': data['count'],
            'avg_rating': avg
        })

    # Sort departments by count desc
    by_department.sort(key=lambda x: x['count'], reverse=True)

    # Feedback type breakdown
    type_map = {}
    for f in all_feedback:
        type_map[f.feedback_type] = type_map.get(f.feedback_type, 0) + 1

    by_type = [{'type': t, 'count': c} for t, c in type_map.items()]
    by_type.sort(key=lambda x: x['count'], reverse=True)

    # Rating distribution
    rating_dist = {str(r): 0 for r in range(1, 6)}
    for f in all_feedback:
        rating_dist[str(f.rating)] = rating_dist.get(str(f.rating), 0) + 1

    return jsonify({
        'total_count': total_count,
        'reviewed_count': reviewed_count,
        'pending_count': pending_count,
        'overall_avg_rating': overall_avg_rating,
        'by_department': by_department,
        'by_type': by_type,
        'rating_distribution': rating_dist
    }), 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)

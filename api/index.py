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
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'AcademiaAdmin2026!')

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

# Sentiment & Priority Analysis Helper Engine
POSITIVE_WORDS = {'excellent', 'outstanding', 'great', 'explained', 'helpful', 'clear', 'love', 'best', 'fantastic', 'interactive', 'recommend', 'insightful', 'good', 'well', 'thorough', 'organized'}
NEGATIVE_WORDS = {'poor', 'broken', 'freeze', 'slow', 'late', 'unfair', 'terrible', 'bad', 'issue', 'problem', 'fix', 'recalibration', 'hard', 'difficult', 'confusing', 'delay', 'lack', 'worst'}
URGENT_WORDS = {'hazard', 'emergency', 'safety', 'cheat', 'harassment', 'broken', 'freeze', 'danger', 'unusable', 'zero'}

def analyze_sentiment_and_priority(text, rating):
    words = text.lower().split()
    pos_count = sum(1 for w in words if any(p in w for p in POSITIVE_WORDS))
    neg_count = sum(1 for w in words if any(n in w for n in NEGATIVE_WORDS))
    urgent_count = sum(1 for w in words if any(u in w for u in URGENT_WORDS))

    # Determine Sentiment
    if rating >= 4 and pos_count >= neg_count:
        sentiment = 'Positive'
    elif rating <= 2 or neg_count > pos_count:
        sentiment = 'Negative'
    else:
        sentiment = 'Neutral'

    # Determine Priority
    if rating <= 2 or urgent_count > 0:
        priority = 'High'
    elif rating == 3 or neg_count > 0:
        priority = 'Medium'
    else:
        priority = 'Low'

    return sentiment, priority

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
    sentiment = db.Column(db.String(20), default='Neutral')
    priority = db.Column(db.String(20), default='Medium')
    status = db.Column(db.String(20), default='Pending') # 'Pending' or 'Reviewed'
    resolution_notes = db.Column(db.Text, nullable=True)
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
            'sentiment': self.sentiment,
            'priority': self.priority,
            'status': self.status,
            'resolution_notes': self.resolution_notes or '',
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
        samples = [
            ("Alex Morgan", "CS2023001", "Computer Science", "Data Structures & Algorithms", "Teaching", 5, "Professor explained complex graph algorithms with clear visualization and interactive coding examples. Outstanding class!", "Reviewed", "Discussed in faculty review meeting. Kudos passed to instructor."),
            ("Sophia Chen", "ECE2023042", "Electrical Engineering", "Digital Signal Processing", "Facilities", 2, "Lab equipment in room 302 needs recalibration. Oscilloscopes occasionally freeze during signal sampling experiments.", "Pending", None),
            ("Marcus Vance", "ME2023018", "Mechanical Engineering", "Thermodynamics II", "Curriculum", 4, "Syllabus is very comprehensive, but adding a practical project on renewable thermal energy systems would make it even better.", "Reviewed", "Curriculum committee notified for next syllabus revision."),
            ("Emma Watson", "CS2023089", "Computer Science", "Database Management Systems", "Teaching", 5, "Great hands-on SQL workshops! The practical exercises on query optimization were immensely helpful.", "Pending", None),
            ("David Miller", "CE2023005", "Civil Engineering", "Structural Mechanics", "Other", 2, "Course pace was extremely fast before midterms, and slide decks were uploaded very late prior to examinations.", "Pending", None),
            ("Priya Patel", "BUS2023011", "Business Administration", "Financial Accounting", "Teaching", 5, "Case study approach helped bridge theoretical accounting standards with real corporate balance sheets. Highly recommend!", "Reviewed", "Positive feedback logged into instructor portfolio.")
        ]
        
        sample_objects = []
        for idx, s in enumerate(samples):
            sent, prio = analyze_sentiment_and_priority(s[6], s[5])
            fb = Feedback(
                student_name=s[0],
                roll_number=s[1],
                department=s[2],
                course_name=s[3],
                feedback_type=s[4],
                rating=s[5],
                message=s[6],
                sentiment=sent,
                priority=prio,
                status=s[7],
                resolution_notes=s[8],
                created_at=datetime.utcnow() - timedelta(days=6-idx)
            )
            sample_objects.append(fb)

        db.session.bulk_save_objects(sample_objects)
        db.session.commit()

with app.app_context():
    db.create_all()
    try:
        seed_sample_data()
    except Exception as e:
        db.session.rollback()
        print("Data seeding note:", e)

# API Endpoints

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'service': 'Student Feedback Enterprise API'}), 200

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username = (data.get('username') or '').strip()
    password = (data.get('password') or '').strip()

    expected_username = os.environ.get('ADMIN_USERNAME', 'admin').strip()
    expected_password = os.environ.get('ADMIN_PASSWORD', 'AcademiaAdmin2026!').strip()

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    if username == expected_username and password == expected_password:
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
        errors.append('Feedback category is required.')
    if rating is None or not isinstance(rating, int) or rating < 1 or rating > 5:
        errors.append('Rating must be an integer between 1 and 5.')
    if not message or len(message) < 5:
        errors.append('Feedback message must be at least 5 characters long.')

    if errors:
        return jsonify({'error': 'Validation failed', 'details': errors}), 400

    sentiment, priority = analyze_sentiment_and_priority(message, rating)

    try:
        new_feedback = Feedback(
            student_name=student_name,
            roll_number=roll_number,
            department=department,
            course_name=course_name,
            feedback_type=feedback_type,
            rating=rating,
            message=message,
            sentiment=sentiment,
            priority=priority,
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

    # Search filter
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

    # Category filter
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

    # Sentiment filter
    sentiment = request.args.get('sentiment', '').strip()
    if sentiment and sentiment != 'all':
        query = query.filter(Feedback.sentiment == sentiment)

    # Priority filter
    priority = request.args.get('priority', '').strip()
    if priority and priority != 'all':
        query = query.filter(Feedback.priority == priority)

    # Sort
    sort_by = request.args.get('sort_by', 'created_at')
    order = request.args.get('order', 'desc')

    if sort_by == 'rating':
        column = Feedback.rating
    elif sort_by == 'student_name':
        column = Feedback.student_name
    elif sort_by == 'priority':
        column = Feedback.priority
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
    if 'resolution_notes' in data:
        item.resolution_notes = data['resolution_notes'].strip()

    db.session.commit()

    return jsonify({
        'message': f'Feedback marked as {new_status}',
        'feedback': item.to_dict()
    }), 200

@app.route('/api/feedback/<int:feedback_id>/resolve', methods=['PUT'])
@admin_required
def resolve_feedback(feedback_id):
    item = Feedback.query.get(feedback_id)
    if not item:
        return jsonify({'error': 'Feedback not found'}), 404

    data = request.get_json() or {}
    notes = data.get('resolution_notes', '').strip()

    item.status = 'Reviewed'
    item.resolution_notes = notes
    db.session.commit()

    return jsonify({
        'message': 'Resolution logged and feedback marked as Reviewed',
        'feedback': item.to_dict()
    }), 200

@app.route('/api/feedback/bulk-update', methods=['POST'])
@admin_required
def bulk_update_feedback():
    data = request.get_json() or {}
    action = data.get('action') # 'mark_reviewed', 'mark_pending', 'delete'
    ids = data.get('ids', [])

    if not ids or not isinstance(ids, list):
        return jsonify({'error': 'No valid feedback IDs provided'}), 400

    items = Feedback.query.filter(Feedback.id.in_(ids)).all()
    if not items:
        return jsonify({'error': 'No matching feedback items found'}), 404

    count = len(items)
    if action == 'mark_reviewed':
        for item in items:
            item.status = 'Reviewed'
        msg = f'{count} items marked as Reviewed'
    elif action == 'mark_pending':
        for item in items:
            item.status = 'Pending'
        msg = f'{count} items marked as Pending'
    elif action == 'delete':
        for item in items:
            db.session.delete(item)
        msg = f'{count} items deleted successfully'
    else:
        return jsonify({'error': 'Invalid action'}), 400

    db.session.commit()
    return jsonify({'message': msg, 'count': count}), 200

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
            'rating_distribution': {'1': 0, '2': 0, '3': 0, '4': 0, '5': 0},
            'sentiment_breakdown': {'Positive': 0, 'Neutral': 0, 'Negative': 0},
            'priority_breakdown': {'High': 0, 'Medium': 0, 'Low': 0}
        }), 200

    reviewed_count = sum(1 for f in all_feedback if f.status == 'Reviewed')
    pending_count = total_count - reviewed_count
    overall_avg_rating = round(sum(f.rating for f in all_feedback) / total_count, 2)

    # Department breakdown & Grade
    dept_map = {}
    for f in all_feedback:
        if f.department not in dept_map:
            dept_map[f.department] = {'ratings': [], 'count': 0}
        dept_map[f.department]['ratings'].append(f.rating)
        dept_map[f.department]['count'] += 1

    by_department = []
    for dept, data in dept_map.items():
        avg = round(sum(data['ratings']) / len(data['ratings']), 2)
        # Letter Grade calculation
        if avg >= 4.5: grade = 'A+'
        elif avg >= 4.0: grade = 'A'
        elif avg >= 3.5: grade = 'B+'
        elif avg >= 3.0: grade = 'B'
        else: grade = 'C'

        by_department.append({
            'department': dept,
            'count': data['count'],
            'avg_rating': avg,
            'grade': grade
        })

    by_department.sort(key=lambda x: x['count'], reverse=True)

    # Category breakdown
    type_map = {}
    for f in all_feedback:
        type_map[f.feedback_type] = type_map.get(f.feedback_type, 0) + 1

    by_type = [{'type': t, 'count': c} for t, c in type_map.items()]
    by_type.sort(key=lambda x: x['count'], reverse=True)

    # Rating distribution
    rating_dist = {str(r): 0 for r in range(1, 6)}
    for f in all_feedback:
        rating_dist[str(f.rating)] = rating_dist.get(str(f.rating), 0) + 1

    # Sentiment Breakdown
    sentiment_dist = {'Positive': 0, 'Neutral': 0, 'Negative': 0}
    for f in all_feedback:
        s = f.sentiment or 'Neutral'
        sentiment_dist[s] = sentiment_dist.get(s, 0) + 1

    # Priority Breakdown
    priority_dist = {'High': 0, 'Medium': 0, 'Low': 0}
    for f in all_feedback:
        p = f.priority or 'Medium'
        priority_dist[p] = priority_dist.get(p, 0) + 1

    return jsonify({
        'total_count': total_count,
        'reviewed_count': reviewed_count,
        'pending_count': pending_count,
        'overall_avg_rating': overall_avg_rating,
        'by_department': by_department,
        'by_type': by_type,
        'rating_distribution': rating_dist,
        'sentiment_breakdown': sentiment_dist,
        'priority_breakdown': priority_dist
    }), 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)

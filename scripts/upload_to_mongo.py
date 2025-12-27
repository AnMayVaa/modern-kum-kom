import json
import os
from pymongo import MongoClient
from dotenv import load_dotenv

# โหลดค่าจาก .env.local
load_dotenv(dotenv_path='../.env.local')
MONGODB_URI = os.getenv('MONGODB_URI')

def upload_words():
    try:
        # 1. อ่านไฟล์ JSON ที่สกัดมาได้
        with open('../src/lib/word_list.json', 'r', encoding='utf-8') as f:
            words = json.load(f)
        
        # 2. เชื่อมต่อ MongoDB Atlas
        client = MongoClient(MONGODB_URI)
        db = client["kumkom_db"] # หรือชื่อตามใน .env
        collection = db["vocabulary"]
        
        # 3. เตรียมข้อมูล (แปลงเป็นรูปแบบ Document)
        documents = [{"word": w} for w in words]
        
        # 4. ล้างข้อมูลเก่า (ถ้ามี) และอัปโหลดใหม่
        collection.delete_many({}) 
        collection.insert_many(documents)
        
        print(f"✅ อัปโหลดคำศัพท์สำเร็จทั้งหมด {len(documents)} คำ!")
        
    except Exception as e:
        print(f"❌ เกิดข้อผิดพลาด: {e}")

if __name__ == "__main__":
    upload_words()
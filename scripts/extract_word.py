import pyodbc
import json
import os

def extract_mdb():
    # กำหนด Path ให้ถูกต้อง
    base_path = os.path.dirname(os.path.abspath(__file__))
    mdb_path = os.path.join(base_path, 'word.mdb')
    output_path = os.path.join(base_path, '..', 'src', 'lib', 'word_list.json')

    # เชื่อมต่อกับไฟล์ word.mdb
    conn_str = f'DRIVER={{Microsoft Access Driver (*.mdb, *.accdb)}};DBQ={mdb_path};'
    
    try:
        conn = pyodbc.connect(conn_str)
        # ตั้งค่าการถอดรหัสภาษาไทยสำหรับ Microsoft Access
        conn.setdecoding(pyodbc.SQL_CHAR, encoding='cp874')
        conn.setdecoding(pyodbc.SQL_WCHAR, encoding='utf-16le')
        
        cursor = conn.cursor()
        
        # ดึงข้อมูลจากตาราง Dictionary คอลัมน์ wordID
        print("กำลังดึงข้อมูลจากตาราง Dictionary...")
        cursor.execute("SELECT wordID FROM Dictionary") 
        
        # ดึงข้อมูลทั้งหมดและตัดช่องว่างออก
        words = []
        for row in cursor.fetchall():
            if row[0]:
                word = str(row[0]).strip()
                if word:
                    words.append(word)
        
        # บันทึกไฟล์ JSON
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(words, f, ensure_ascii=False, indent=2)
        
        print("-" * 30)
        print(f"✅ สกัดข้อมูลสำเร็จทั้งหมด {len(words)} คำ")
        
        # ตรวจสอบกับจำนวนในรูปภาพ
        if len(words) == 25924:
            print("✨ ยอดเยี่ยม! จำนวนคำตรงตามใน Access เป๊ะ (25,924 คำ)")
        else:
            print(f"⚠️ จำนวนคำ ({len(words)}) ยังไม่ตรงกับ 25,924 คำ โปรดเช็กข้อมูลอีกครั้ง")
        print("-" * 30)

    except Exception as e:
        print(f"❌ เกิดข้อผิดพลาด: {e}")

if __name__ == "__main__":
    extract_mdb()
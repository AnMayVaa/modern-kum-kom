// ค่าน้ำหนักคะแนนอ้างอิงจากโค้ด Python ของคุณ
export const LETTER_SCORES: Record<string, number> = {
    'ก': 1, 'ข': 3, 'ค': 2, 'ฆ': 6, 'ง': 1, 'จ': 2, 'ฉ': 6, 'ช': 3, 'ฌ': 8, 'ซ': 6,
    'ด': 1, 'ต': 3, 'ถ': 4, 'ท': 2, 'ธ': 5, 'น': 1, 'บ': 1, 'ป': 3, 'ผ': 3, 'ฝ': 4,
    'พ': 3, 'ฟ': 4, 'ภ': 7, 'ม': 1, 'ย': 1, 'ร': 1, 'ล': 1, 'ว': 1, 'ส': 3, 'ห': 4,
    'อ': 1, 'ฮ': 6, 'า': 1, 'ำ': 2, 'เ': 1, 'แ': 2, 'ไ': 2, 'ใ': 2, 'โ': 2, 'ะ': 1,
    'ิ': 0, 'ี': 0, 'ึ': 0, 'ื': 0, 'ุ': 0, 'ู': 0, '่': 0, '้': 0, '๊': 0, '๋': 0, '็': 0, '์': 0, 'ั': 0
};

// ฟังก์ชันล้างวรรณยุกต์เพื่อหาตำแหน่งวางเบี้ย
export const stripThaiWord = (word: string) => {
    const unwantedChars = /[ิีึืุู่ว้๊๋็์ั]/g;
    return word.replace(unwantedChars, '');
};

// ฟังก์ชันแยกพยัญชนะและสระ/วรรณยุกต์ให้อยู่ในกลุ่มเดียวกัน (1 เบี้ย = 1 กลุ่ม)
export const splitThaiWord = (word: string): string[] => {
    const result: string[] = [];
    const specialChars = /[ิีึืุู่ว้๊๋็์ั]/g;
    
    for (const char of word) {
        if (char.match(specialChars) && result.length > 0) {
            result[result.length - 1] += char;
        } else {
            result.push(char);
        }
    }
    return result;
};

// Logic การคำนวณคะแนนเบื้องต้น (ยึดตามหลักการใน Python ของคุณ)
export const calculateWordScore = (word: string, multipliers: string[]) => {
    let totalScore = 0;
    let wordMultiplier = 1;
    const splitWord = splitThaiWord(word);

    splitWord.forEach((tile, index) => {
        let tileScore = 0;
        // รวมคะแนนทุกตัวใน 1 เบี้ย (เช่น 'ก้' = คะแนน ก + คะแนน ้)
        for (const char of tile) {
            tileScore += LETTER_SCORES[char] || 0;
        }

        const m = multipliers[index];
        if (m === '2L') tileScore *= 2;
        if (m === '3L') tileScore *= 3;
        if (m === '4L') tileScore *= 4;
        if (m === '2W') wordMultiplier *= 2;
        if (m === '3W') wordMultiplier *= 3;

        totalScore += tileScore;
    });

    return totalScore * wordMultiplier;
};
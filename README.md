# Parking Lot System

## Design Decisions
-การออกแบบลานจอดรถ (Parking Lot Design)
โจทย์บอกแต่ทางเขัามีทางเดียว
1) ซับซ้อน ใช้ความคิดสร้างสรรค์มากเช่น radius , grid 
2) simple  linear lot เรึยบง่ายตรงโจทย์
ผมเลือก 2 ,1 ดูคิดมากเกินไป น่าจะใช้เวลาเยอะเกิน
-Car Size กับ Slot
โจทย์บอกว่ารถมี size (small, medium, large) แต่ไม่ได้บอกว่า slot มี size 
ทางเลือกหลักๆคือ 
1) Slot ไม่มี size	ทุก slot จอดได้ทุก size, เก็บ car size ไว้แค่เป็น metadata --->ปกติ
2) Slot มี size	Small slot จอดได้แค่ small, Large slot จอดได้ทุก size --->ซับซ้อนขึ้น แต่ realistic กว่า 
ผมเลือก 2 เพิ่มความน่าสนใจและไม่ใช้เวลามาก
-การจัดวางของ slot แต่ละชนิด
example 30-30-30 total 90
1) Random ไม่มีในชีวิตจริง ดูแปลกๆซับซ้อนเพิ่มงานตัวเอง
2) small(1-30) - medium(31-60) -large(61-90) ไม่ดีนะเพราะ small จอดได้แค่ small ,  large and medium อาจต้องจอดไกลโดยไม่มีเหตุผล สำหรับช่วงแรกๆ
3) large - medium - small  ง่ายต่อการเข้าจอดที่ใกล้สุด
ผมเลือก 3

## Assumptions
- Parking lot has a single entry point
- Slot 1 is nearest to entry, Slot N is farthest  
- Small car can park in Small/Medium/Large slot
- Medium car can park in Medium/Large slot
- Large car can park in Large slot only
- One car = one plate number, no duplicate parking

## Tech Stack
- NestJS, TypeScript, PostgreSQL, TypeORM, Docker


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

- string ใช้ uppercase ทั้งหมด
car and slot size SMALL,LARGE,MEDIUM 
plate number ABC-1245 เหมาะสมกับ realistic


API design
POST   /parking-lots                          → สร้าง parking lot
GET    /parking-lots/:id                      → ดูข้อมูล parking lot

POST   /parking-lots/:id/park                 → จอดรถ (ออก ticket)
POST   /parking-lots/:id/leave/:ticketId      → ออกจาก slot (คืน ticket)

GET    /parking-lots/:id/status               → สถานะ parking lot (slot ว่าง/ไม่ว่าง)
GET    /parking-lots/:id/cars?size=SMALL       → plate number list by car size
GET    /parking-lots/:id/slots?size=SMALL      → allocated slot number list by car size
-- Seed data for parties table
INSERT INTO parties (
    name, code, type, gstin, address, city, state, pincode, phone, email, is_active
) VALUES 
(
    'ACME Corporation', '100001', 'both', '27AAACA1234A1Z1', 
    'Industrial Area, Phase II', 'Goa', 'Goa', '403722', '9876543210', 'admin@acme.com', true
),
(
    'Bharat Logistics', '100002', 'consignee', '27BBABA5678B2Z2', 
    'Main St, Near Station', 'Mumbai', 'Maharashtra', '403001', '9822113344', 'ops@bharat.in', true
),
(
    'SIEMENS LTD', 'C001', 'consignor', '30AAAAA0000A1Z5', 
    'VERNA INDUSTRIAL ESTATE, GOA', 'Verna', 'Goa', '403722', '9876543210', 'logistics@siemens.com', true
),
(
    'RELIANCE INDUSTRIES LTD', 'R005', 'consignee', '27BBBBB1111B1Z2', 
    'PATALGANGA, MAHARASHTRA', 'Patalganga', 'Maharashtra', '410220', '9876543211', 'inward@reliance.com', true
),
(
    'ABB INDIA LTD', 'A002', 'consignor', '29CCCCC2222C1Z3', 
    'PEENYA INDUSTRIAL ESTATE', 'Bangalore', 'Karnataka', '560058', '8012345678', 'shipping@abb.com', true
),
(
    'TATA MOTORS', 'T007', 'consignee', '27DDDDD3333D1Z4', 
    'PIMPRI INDUSTRIAL AREA', 'Pune', 'Maharashtra', '411018', '2022334455', 'inbound@tatamotors.com', true
),
(
    'L&T CONSTRUCTION', 'L009', 'consignor', '33EEEEE4444E1Z5', 
    'MOUNT POONAMALLEE ROAD', 'Chennai', 'Tamil Nadu', '600089', '4411223344', 'admin@lntecc.com', true
),
(
    'JINDAL STEEL', 'J011', 'consignee', '29FFFFF5555F1Z6', 
    'TORANAGALLU', 'Bellary', 'Karnataka', '583123', '8395250121', 'logistics@jsw.in', true
),
(
    'VEDANTA LTD', 'V013', 'both', '30GGGGG6666G1Z7', 
    'SESAGOA', 'Panaji', 'Goa', '403001', '8322460600', 'info@vedanta.com', true
),
(
    'VISVESVARAYA IRON AND STEEL', 'VIS01', 'consignee', '29HHHHH7777H1Z8', 
    'BHADRAVATI', 'Bhadravati', 'Karnataka', '577301', '8282271621', 'vsp.mill@sail.in', true
);

-- Create consignments table
CREATE TABLE IF NOT EXISTS consignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cn_no VARCHAR(30) NOT NULL UNIQUE,
    bkg_date DATE NOT NULL DEFAULT CURRENT_DATE,
    booking_branch VARCHAR(50),
    dest_branch VARCHAR(100),
    delivery_type VARCHAR(50),
    distance_km INTEGER DEFAULT 0,
    owner_risk BOOLEAN DEFAULT true,
    door_collection BOOLEAN DEFAULT false,
    cancel_cn BOOLEAN DEFAULT false,
    bkg_basis VARCHAR(30),

    -- Consignor
    consignor_name TEXT,
    consignor_code VARCHAR(30),
    consignor_gst VARCHAR(20),
    consignor_address TEXT,
    consignor_mobile VARCHAR(20),
    consignor_email VARCHAR(100),

    -- Consignee
    consignee_name TEXT,
    consignee_code VARCHAR(30),
    consignee_gst VARCHAR(20),
    consignee_address TEXT,
    consignee_mobile VARCHAR(20),
    consignee_email VARCHAR(100),

    -- Billing
    billing_party TEXT,
    billing_party_code VARCHAR(30),
    billing_party_gst VARCHAR(20),
    billing_party_address TEXT,
    billing_branch VARCHAR(50),

    -- Package & Goods
    no_of_pkg INTEGER DEFAULT 0,
    total_qty INTEGER DEFAULT 0,
    is_loose BOOLEAN DEFAULT false,
    packages JSONB DEFAULT '[]',
    goods_class VARCHAR(50),
    goods_value DECIMAL(12, 2) DEFAULT 0,
    goods_desc TEXT,
    hsn_desc TEXT,
    cod_amount DECIMAL(10, 2) DEFAULT 0,
    actual_weight DECIMAL(10, 2) DEFAULT 0,
    charged_weight DECIMAL(10, 2) DEFAULT 0,
    load_unit VARCHAR(10) DEFAULT 'KG',
    dimension_l DECIMAL(8, 2) DEFAULT 0,
    dimension_w DECIMAL(8, 2) DEFAULT 0,
    dimension_h DECIMAL(8, 2) DEFAULT 0,
    volume DECIMAL(12, 2) DEFAULT 0,
    private_mark TEXT,

    -- Freight
    freight_pending BOOLEAN DEFAULT false,
    freight_rate DECIMAL(10, 2) DEFAULT 0,
    basic_freight DECIMAL(10, 2) DEFAULT 0,
    unload_charges DECIMAL(10, 2) DEFAULT 0,
    retention_charges DECIMAL(10, 2) DEFAULT 0,
    extra_km_charges DECIMAL(10, 2) DEFAULT 0,
    mhc_charges DECIMAL(10, 2) DEFAULT 0,
    door_coll_charges DECIMAL(10, 2) DEFAULT 0,
    door_del_charges DECIMAL(10, 2) DEFAULT 0,
    other_charges DECIMAL(10, 2) DEFAULT 0,
    total_freight DECIMAL(12, 2) DEFAULT 0,
    advance_amount DECIMAL(10, 2) DEFAULT 0,
    balance_amount DECIMAL(12, 2) DEFAULT 0,

    -- Invoice
    invoice_no VARCHAR(50),
    invoice_date DATE,
    invoice_amount DECIMAL(12, 2) DEFAULT 0,
    indent_no VARCHAR(50),
    indent_date DATE,
    eway_bill VARCHAR(50),
    eway_from_date DATE,
    eway_to_date DATE,

    -- Insurance
    insurance_company VARCHAR(100),
    policy_no VARCHAR(50),
    policy_date DATE,
    policy_amount DECIMAL(12, 2) DEFAULT 0,
    po_no VARCHAR(50),
    po_date DATE,
    stf_no VARCHAR(50),
    stf_date DATE,
    stf_valid_upto DATE,

    -- Others
    business_type VARCHAR(30) DEFAULT 'REGULAR',
    transport_mode VARCHAR(30) DEFAULT 'BY ROAD',
    doc_prepared_by TEXT,
    remarks TEXT,

    -- Meta
    status TEXT NOT NULL DEFAULT 'BOOKED' CHECK (status IN ('BOOKED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED')),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE consignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow read consignments for authenticated" ON consignments
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow insert consignments for authenticated" ON consignments
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Allow update consignments for authenticated" ON consignments
    FOR UPDATE TO authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_consignments_cn_no ON consignments(cn_no);
CREATE INDEX IF NOT EXISTS idx_consignments_bkg_date ON consignments(bkg_date);
CREATE INDEX IF NOT EXISTS idx_consignments_status ON consignments(status);

-- Trigger for updated_at
CREATE TRIGGER set_consignments_updated_at
    BEFORE UPDATE ON consignments
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

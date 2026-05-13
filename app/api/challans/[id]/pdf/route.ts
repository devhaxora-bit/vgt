import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import jsPDF from 'jspdf';

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const supabase = await createClient();
    const { id } = await params;

    try {
        // Fetch challan with relations
        const { data: challan, error } = await supabase
            .from('challans')
            .select(`
                *,
                origin_branch:branches!origin_branch_code(name, city),
                destination_branch:branches!destination_branch_code(name, city)
            `)
            .eq('id', id)
            .single();

        if (error || !challan) {
            return NextResponse.json({ error: 'Challan not found' }, { status: 404 });
        }

        // Generate PDF using jsPDF
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4',
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 10;
        let yPos = margin;

        // Helper functions
        const addBox = (x: number, y: number, width: number, height: number) => {
            doc.setDrawColor(0);
            doc.rect(x, y, width, height);
        };

        const addHorizontalLine = (x: number, y: number, width: number) => {
            doc.setDrawColor(0);
            doc.line(x, y, x + width, y);
        };

        const addText = (text: string, x: number, y: number, fontSize = 10, isBold = false) => {
            doc.setFontSize(fontSize);
            doc.setFont('helvetica', isBold ? 'bold' : 'normal');
            doc.text(text, x, y);
        };

        const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize = 10, isBold = false) => {
            doc.setFontSize(fontSize);
            doc.setFont('helvetica', isBold ? 'bold' : 'normal');
            const lines = doc.splitTextToSize(text, maxWidth);
            doc.text(lines, x, y);
            return y + (lines.length * (fontSize / 2.8));
        };

        // HEADER SECTION
        addText('CHALLAN', pageWidth / 2, yPos + 5, 18, true);
        addText(`Challan No: ${challan.challan_no}`, margin, yPos + 15, 11, true);
        addText(`Date: ${new Date(challan.date_from).toLocaleDateString()}`, pageWidth - margin - 50, yPos + 15, 11, true);
        yPos += 22;
        addHorizontalLine(margin, yPos, pageWidth - 2 * margin);
        yPos += 3;

        // TRIP DETAILS
        addText('TRIP DETAILS', margin, yPos, 11, true);
        yPos += 5;
        const tripDetailsData = [
            [`Origin: ${challan.origin_branch?.name || '-'}`, `Vehicle No: ${challan.vehicle_no || '-'}`],
            [`Loading Pt: ${challan.loading_point || '-'}`, `Vehicle Type: ${challan.vehicle_type || '-'}`],
            [`Destination: ${challan.destination_point || '-'}`, `Permit No: ${challan.permit_no || '-'}`],
        ];
        tripDetailsData.forEach((row) => {
            addText(row[0], margin, yPos, 9);
            addText(row[1], pageWidth / 2, yPos, 9);
            yPos += 4;
        });
        yPos += 2;

        // VEHICLE DETAILS
        addText('VEHICLE DETAILS', margin, yPos, 11, true);
        yPos += 5;
        const vehicleDetailsData = [
            [`Make: ${challan.vehicle_make || '-'}`, `Model: ${challan.vehicle_model || '-'}`],
            [`Engine: ${challan.engine_no || '-'}`, `Chassis: ${challan.chasis_no || '-'}`],
        ];
        vehicleDetailsData.forEach((row) => {
            addText(row[0], margin, yPos, 9);
            addText(row[1], pageWidth / 2, yPos, 9);
            yPos += 4;
        });
        yPos += 2;

        // DRIVER & OWNER DETAILS
        addText('DRIVER & OWNER DETAILS', margin, yPos, 11, true);
        yPos += 5;
        addText(`Driver: ${challan.driver_name || '-'} | Mobile: ${challan.driver_mobile || '-'} | DL: ${challan.driver_dl_no || '-'}`, margin, yPos, 9);
        yPos += 4;

        if (challan.engagement_type === 'broker') {
            addText(`Broker: ${challan.broker_name || '-'} | Code: ${challan.broker_code || '-'} | Mobile: ${challan.broker_mobile || '-'}`, margin, yPos, 9);
        } else {
            addText(`Owner: ${challan.owner_name || '-'} | PAN: ${challan.owner_pan || '-'} | Mobile: ${challan.owner_mobile || '-'}`, margin, yPos, 9);
        }
        yPos += 5;

        // FINANCIAL DETAILS — individual rows only for non-zero values
        addText('HIRE DETAILS', margin, yPos, 11, true);
        yPos += 5;

        const labelW = 80;
        const valueX = margin + labelW + 2;
        const fmt = (n: number) => `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

        const hireRows: [string, number][] = [
            ['Hire Amount', Number(challan.hire_amount) || 0],
            ['Extra Over Weight', Number(challan.extra_over_weight) || 0],
            ['Over Length', Number(challan.extra_over_length) || 0],
            ['Over Width', Number(challan.extra_over_width) || 0],
            ['Over Height', Number(challan.extra_over_height) || 0],
            ['Extra KM Charges', Number(challan.extra_km_charges) || 0],
            ['Detent Charges', Number(challan.detent_charges) || 0],
            ['Transit Pass Charges', Number(challan.transit_pass_charges) || 0],
        ];

        // Only print rows with non-zero values
        hireRows.filter(([, v]) => v > 0).forEach(([label, value]) => {
            addText(label, margin + 4, yPos, 9);
            addText(fmt(value), valueX + 40, yPos, 9);
            yPos += 4.5;
        });

        // Total extra charges subtotal if any extras exist
        const totalExtra = Number(challan.total_extra_charges) || 0;
        if (totalExtra > 0) {
            addHorizontalLine(margin, yPos, 100);
            yPos += 2;
            addText('Total Extra Charges', margin + 4, yPos, 9, true);
            addText(fmt(totalExtra), valueX + 40, yPos, 9, true);
            yPos += 5;
        }

        // Total hire
        addText('TOTAL HIRE', margin + 4, yPos, 10, true);
        addText(fmt(Number(challan.total_hire_amount) || 0), valueX + 40, yPos, 10, true);
        yPos += 5;

        // Deductions
        const advance = Number(challan.advance_amount) || 0;
        const lessTds = Number(challan.less_tds) || 0;
        if (advance > 0) {
            addText(`Advance Paid`, margin + 4, yPos, 9);
            addText(`- ${fmt(advance)}`, valueX + 40, yPos, 9);
            yPos += 4.5;
        }
        if (lessTds > 0) {
            addText(`Less TDS (${challan.tds_percent || 0}%)`, margin + 4, yPos, 9);
            addText(`- ${fmt(lessTds)}`, valueX + 40, yPos, 9);
            yPos += 4.5;
        }

        addHorizontalLine(margin, yPos, 100);
        yPos += 2;
        const balance = (Number(challan.total_hire_amount) || 0) - advance - lessTds;
        addText('BALANCE PAYABLE', margin + 4, yPos, 10, true);
        addText(fmt(balance), valueX + 40, yPos, 10, true);
        yPos += 7;

        // LINKED CNs
        if (challan.linked_cn_nos && challan.linked_cn_nos.length > 0) {
            addText('LINKED CNS', margin, yPos, 11, true);
            yPos += 4;
            const cnText = challan.linked_cn_nos.join(', ');
            yPos = addWrappedText(cnText, margin, yPos, pageWidth - 2 * margin, 9);
            yPos += 2;
        }

        // TERMS & CONDITIONS SECTION
        addHorizontalLine(margin, yPos, pageWidth - 2 * margin);
        yPos += 3;

        addText("Truck Should reach on Date ............................................", margin, yPos, 10, true);
        yPos += 6;

        addText("NOTE:", margin, yPos, 10, true);
        yPos += 4;

        const termsAndConditions = [
            "1. Materials Should Be Delivered On Or Before Schedule Date & Time As Mentioned Above. Other Wise Delay Delivery Charges 2% Per Day On Total Lorry Hire Well Be Deducted.",
            "2. Goods Loaded In Good & Sound Condition Hence All Risks & Responsibilities For Safe Movement and Safe Delivery of Goods Rest With Lorry Owner / Driver / Agent",
            "3. Reversal Sign Acknowledgement Should be deposited in 20 days Otherwise Penalty of Rs. 100/- per day will be deducted from Balance Hire"
        ];

        termsAndConditions.forEach((term) => {
            yPos = addWrappedText(term, margin + 3, yPos, pageWidth - 2 * margin - 3, 8);
            yPos += 2;
        });

        yPos += 4;
        addText("We agree to all The Terms & Conditions Mentioned Above And Overleaf", margin, yPos, 10, true);
        yPos += 8;

        // SIGNATURE SECTION
        const signatureY = pageHeight - 20;
        const sig1X = margin;
        const sig2X = pageWidth - 35;

        addHorizontalLine(sig1X, signatureY, 30);
        addHorizontalLine(sig2X, signatureY, 30);

        addText('Agent', sig1X, signatureY + 3, 9, true);
        addText('Driver', sig2X, signatureY + 3, 9, true);

        // Generate PDF as blob
        const pdfBytes = doc.output('arraybuffer');
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });

        return new NextResponse(blob, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="challan-${challan.challan_no}.pdf"`,
            },
        });
    } catch (error) {
        console.error('PDF generation error:', error);
        return NextResponse.json(
            { error: 'Failed to generate PDF' },
            { status: 500 }
        );
    }
}

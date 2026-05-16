'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeft, Save, RotateCcw, FileText, Truck, Users,
    Shield, CreditCard, Info, Link2, X, Download
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { useDebounce } from '@/hooks/use-debounce';

// Branch interface
interface Branch {
    id: string;
    code: string;
    name: string;
    city: string;
}

interface LinkedConsignment {
    id: string;
    cn_no: string;
    packages?: Array<{ method?: string; qty?: number; sr_no?: number }>;
    no_of_pkg?: number;
    total_qty?: number;
    goods_class?: string;
    goods_desc?: string;
    actual_weight?: number | string;
    charged_weight?: number | string;
    load_unit?: string;
    dest_branch?: string;
    delivery_point?: string;
}


function NewChallanPageContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const editId = searchParams.get('edit');
    const isEditMode = !!editId;

    const [branches, setBranches] = useState<Branch[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(isEditMode);
    // Basic Details
    const [originBranch, setOriginBranch] = useState('MRG');
    const [challanNo, setChallanNo] = useState('');
    const [challanDate, setChallanDate] = useState(new Date().toISOString().split('T')[0]);
    const [challanTime, setChallanTime] = useState(new Date().toTimeString().slice(0, 5));
    const [loadingPoint, setLoadingPoint] = useState('');
    const [destinationPoint, setDestinationPoint] = useState('');
    const [linkedCnInput, setLinkedCnInput] = useState('');
    const [linkedConsignments, setLinkedConsignments] = useState<LinkedConsignment[]>([]);
    const [cnSuggestions, setCnSuggestions] = useState<LinkedConsignment[]>([]);
    const [showCnSuggestions, setShowCnSuggestions] = useState(false);
    const [vehicleOwnerStatus, setVehicleOwnerStatus] = useState('');
    const [vehicleSuggestions, setVehicleSuggestions] = useState<any[]>([]);
    const [showVehicleSuggestions, setShowVehicleSuggestions] = useState(false);
    const vehicleFocusedRef = useRef(false);
    const brokerFocusedRef = useRef(false);
    const linkedConsignmentsRef = useRef<LinkedConsignment[]>([]);
    useEffect(() => { linkedConsignmentsRef.current = linkedConsignments; }, [linkedConsignments]);


    // Owner/Broker
    const [ownerPan, setOwnerPan] = useState('');
    const [ownerName, setOwnerName] = useState('');
    const [ownerMobile, setOwnerMobile] = useState('');
    const [ownerAddress, setOwnerAddress] = useState('');
    const [ownerTel, setOwnerTel] = useState('');
    // Engagement
    const [engagementType, setEngagementType] = useState<'broker' | 'direct'>('broker');
    const [brokerId, setBrokerId] = useState('');
    const [brokerName, setBrokerName] = useState('');
    const [brokerCode, setBrokerCode] = useState('');
    const [brokerMobile, setBrokerMobile] = useState('');
    const [brokerAddress, setBrokerAddress] = useState('');
    const [brokerFetching, setBrokerFetching] = useState(false);
    const [brokerStatus, setBrokerStatus] = useState('');
    const [brokerSuggestions, setBrokerSuggestions] = useState<any[]>([]);
    const [showBrokerSuggestions, setShowBrokerSuggestions] = useState(false);
    const [slipNo, setSlipNo] = useState('');
    const [slipDate, setSlipDate] = useState('');

    // Vehicle
    const [vehicleNo, setVehicleNo] = useState('');
    const [vehicleType, setVehicleType] = useState('open');
    const [permitNo, setPermitNo] = useState('');
    const [permitValidity, setPermitValidity] = useState('');
    const [vehicleMake, setVehicleMake] = useState('tata');
    const [engineNo, setEngineNo] = useState('');
    const [chasisNo, setChasisNo] = useState('');
    const [taxTokenNo, setTaxTokenNo] = useState('');
    const [taxTokenValidity, setTaxTokenValidity] = useState('');
    const [taxTokenIssuedBy, setTaxTokenIssuedBy] = useState('');
    const [vehicleModel, setVehicleModel] = useState('lpt');

    // Driver
    const [driverDlNo, setDriverDlNo] = useState('');
    const [driverName, setDriverName] = useState('');
    const [driverDlValidity, setDriverDlValidity] = useState('');
    const [driverMobile, setDriverMobile] = useState('');
    const [driverAddress, setDriverAddress] = useState('');

    // Insurance & eWaybill
    const [policyNo, setPolicyNo] = useState('');
    const [policyValidity, setPolicyValidity] = useState('');
    const [insCompany, setInsCompany] = useState('');
    const [insCity, setInsCity] = useState('');
    const [financeDetail, setFinanceDetail] = useState('');

    // ITDS Declaration
    const [itdsRefBranch, setItdsRefBranch] = useState('');
    const [itdsDeclareDate, setItdsDeclareDate] = useState('');
    const [itdsFinYear, setItdsFinYear] = useState('2025-2026');

    // Other Info
    const [remarks, setRemarks] = useState('');
    const [tripTracking, setTripTracking] = useState(false);

    // Financial state for Hire Details computed fields
    const [hireDetails, setHireDetails] = useState({
        noOfCns: 0, noOfPackage: 0, actualWeight: 0, chargeWeight: 0,
        rateType: 'mt', rate: 0, hire: 0,
        extraOverWeight: 0, overLength: 0, overWidth: 0, overHeight: 0, extraKmCharges: 0,
        detentCharges: 0, unloadingCharges: 0, totalExtra: 0, totalHire: 0,
        advPayment: 0, tdsPercent: 2, lessTds: 0,
        balAmount: 0,
    });

    // Auto-recalculate aggregates from linked CNs
    useEffect(() => {
        const count = linkedConsignments.length;
        const totalPkg = linkedConsignments.reduce((sum, c) => {
            let pCount = 0;
            if (Array.isArray(c.packages) && c.packages.length > 0) {
                pCount = c.packages.reduce((acc, p) => acc + (Number(p.qty) || 0), 0);
            }
            if (pCount === 0) pCount = Number(c.no_of_pkg || c.total_qty) || 0;
            return sum + pCount;
        }, 0);
        const totalWt = linkedConsignments.reduce((sum, c) => sum + (Number(c.actual_weight) || 0), 0);
        const totalChargeWt = linkedConsignments.reduce((sum, c) => sum + (Number(c.charged_weight) || 0), 0);

        setHireDetails(prev => {
            let next = {
                ...prev,
                noOfCns: count,
                noOfPackage: totalPkg,
                actualWeight: totalWt,
                chargeWeight: totalChargeWt
            };
            
            // Trigger general update step to ripple effect derived calculations if dependent
            next.totalExtra = (next.extraOverWeight || 0) + (next.overLength || 0) + (next.overWidth || 0) + (next.overHeight || 0) + (next.extraKmCharges || 0) + (next.unloadingCharges || 0);
            if (next.rateType === 'mt') {
                next.hire = Math.round((next.chargeWeight || 0) * (next.rate || 0));
            }
            next.totalHire = (next.hire || 0) + (next.totalExtra || 0) + (next.detentCharges || 0);
            next.lessTds = Math.round(next.totalHire * ((next.tdsPercent || 0) / 100));
            next.balAmount = next.totalHire - (next.advPayment || 0) - next.lessTds;
            return next;
        });
    }, [linkedConsignments]);

    // Load challan data for edit mode
    useEffect(() => {
        if (isEditMode && editId) {
            const loadChallan = async () => {
                try {
                    const res = await fetch(`/api/challans/${editId}`);
                    if (!res.ok) throw new Error('Failed to load challan');
                    const data = await res.json();
                    populateFormData(data);

                    // Fetch and populate linked consignments
                    if (Array.isArray(data.linked_cn_nos) && data.linked_cn_nos.length > 0) {
                        try {
                            const cnRes = await fetch(`/api/consignments/by-cn?cns=${data.linked_cn_nos.join(',')}`);
                            if (cnRes.ok) {
                                const cnData = await cnRes.json();
                                if (Array.isArray(cnData)) {
                                    setLinkedConsignments(cnData);
                                }
                            }
                        } catch (cnErr) {
                            console.error('Failed to load linked CNs:', cnErr);
                        }
                    }
                } catch (error) {
                    console.error('Failed to load challan:', error);
                    toast.error('Failed to load challan data');
                } finally {
                    setIsLoading(false);
                }
            };
            loadChallan();
        } else {
            setIsLoading(false);
        }
    }, [editId, isEditMode]);

    const populateFormData = (data: any) => {
        setChallanNo(data.challan_no || '');
        setChallanDate(data.date_from?.split('T')[0] || new Date().toISOString().split('T')[0]);
        setOriginBranch(data.origin_branch_code || 'MRG');
        setLoadingPoint(data.loading_point || '');
        setDestinationPoint(data.destination_point || '');
        setVehicleNo(data.vehicle_no || '');
        setVehicleType(data.vehicle_type || 'open');
        setVehicleMake(data.vehicle_make || 'tata');
        setVehicleModel(data.vehicle_model || 'lpt');
        setEngineNo(data.engine_no || '');
        setChasisNo(data.chasis_no || '');
        setPermitNo(data.permit_no || '');
        setPermitValidity(data.permit_validity || '');
        setTaxTokenNo(data.tax_token_no || '');
        setTaxTokenValidity(data.tax_token_validity || '');
        setTaxTokenIssuedBy(data.tax_token_issued_by || '');

        setOwnerPan(data.owner_pan || '');
        setOwnerName(data.owner_name || '');
        setOwnerMobile(data.owner_mobile || '');
        setOwnerAddress(data.owner_address || '');
        setOwnerTel(data.owner_tel || '');

        setEngagementType(data.engagement_type || 'broker');
        setBrokerId(data.broker_id || '');
        setBrokerName(data.broker_name || '');
        setBrokerCode(data.broker_code || '');
        setBrokerMobile(data.broker_mobile || '');
        setBrokerAddress(data.broker_address || '');
        setSlipNo(data.slip_no || '');
        setSlipDate(data.slip_date || '');

        setDriverDlNo(data.driver_dl_no || '');
        setDriverName(data.driver_name || '');
        setDriverDlValidity(data.driver_dl_validity || '');
        setDriverMobile(data.driver_mobile || '');
        setDriverAddress(data.driver_address || '');

        setPolicyNo(data.insurance_policy_no || '');
        setPolicyValidity(data.insurance_validity || '');
        setInsCompany(data.insurance_company_name || '');
        setInsCity(data.insurance_city || '');
        setFinanceDetail(data.finance_detail || '');

        setItdsRefBranch(data.itds_ref_branch || '');
        setItdsDeclareDate(data.itds_declare_date || '');
        setItdsFinYear(data.itds_financial_year || '2025-2026');

        setRemarks(data.remarks || '');
        setTripTracking(data.trip_tracking_consent || false);

        setHireDetails({
            noOfCns: data.linked_cn_nos?.length || 0,
            noOfPackage: 0,
            actualWeight: 0,
            chargeWeight: 0,
            rateType: 'mt',
            rate: data.hire_rate_per_kg || 0,
            hire: data.hire_amount || 0,
            extraOverWeight: data.extra_over_weight || 0,
            overLength: data.extra_over_length || 0,
            overWidth: data.extra_over_width || 0,
            overHeight: data.extra_over_height || 0,
            extraKmCharges: data.extra_km_charges || 0,
            detentCharges: data.detent_charges || 0,
            unloadingCharges: data.unloading_charges || 0,
            totalExtra: data.total_extra_charges || 0,
            totalHire: data.total_hire_amount || 0,
            advPayment: data.advance_amount || 0,
            tdsPercent: data.tds_percent || 2,
            lessTds: data.less_tds || 0,
            balAmount: 0,
        });
    };

    useEffect(() => {
        const fetchBranches = async () => {
            try {
                const res = await fetch('/api/references/branches');
                if (res.ok) {
                    const data = await res.json();
                    setBranches(data);
                }
            } catch (error) {
                console.error('Failed to fetch branches', error);
                toast.error('Failed to load branches');
            }
        };
        fetchBranches();
    }, []);

    // Fetch next Challan No when origin branch changes — skip in edit mode
    useEffect(() => {
        if (isEditMode) return;
        const fetchNextChallan = async () => {
            try {
                const res = await fetch(`/api/branches/next-challan?branch=${originBranch}`);
                if (res.ok) {
                    const data = await res.json();
                    setChallanNo(data.nextNo.toString());
                }
            } catch (error) {
                console.error('Failed to fetch next challan no', error);
            }
        };
        if (originBranch) fetchNextChallan();
    }, [originBranch, isEditMode]);

    const handleReset = () => {
        setLoadingPoint(''); setDestinationPoint('');
        setLinkedCnInput(''); setLinkedConsignments([]); setCnSuggestions([]); setShowCnSuggestions(false);
        setVehicleNo(''); setVehicleOwnerStatus(''); setVehicleSuggestions([]); setShowVehicleSuggestions(false);
        setVehicleType('open'); setVehicleMake('tata'); setVehicleModel('lpt');
        setPermitNo(''); setPermitValidity(''); setEngineNo(''); setChasisNo('');
        setTaxTokenNo(''); setTaxTokenValidity(''); setTaxTokenIssuedBy('');
        setOwnerPan(''); setOwnerName(''); setOwnerMobile(''); setOwnerAddress(''); setOwnerTel('');
        setEngagementType('broker');
        setBrokerId(''); setBrokerName(''); setBrokerCode(''); setBrokerMobile(''); setBrokerAddress('');
        setBrokerFetching(false); setBrokerStatus(''); setBrokerSuggestions([]); setShowBrokerSuggestions(false);
        setSlipNo(''); setSlipDate('');
        setDriverDlNo(''); setDriverName(''); setDriverDlValidity(''); setDriverMobile(''); setDriverAddress('');
        setPolicyNo(''); setPolicyValidity(''); setInsCompany(''); setInsCity(''); setFinanceDetail('');
        setItdsRefBranch(''); setItdsDeclareDate(''); setItdsFinYear('2025-2026');
        setRemarks(''); setTripTracking(false);
        setChallanDate(new Date().toISOString().split('T')[0]);
        setChallanTime(new Date().toTimeString().slice(0, 5));
        setHireDetails({
            noOfCns: 0, noOfPackage: 0, actualWeight: 0, chargeWeight: 0,
            rateType: 'mt', rate: 0, hire: 0,
            extraOverWeight: 0, overLength: 0, overWidth: 0, overHeight: 0, extraKmCharges: 0,
            detentCharges: 0, unloadingCharges: 0, totalExtra: 0, totalHire: 0,
            advPayment: 0, tdsPercent: 2, lessTds: 0, balAmount: 0,
        });
    };

    const applyVehicleDetails = (v: any) => {
        // Owner
        setOwnerPan(v.owner_pan || '');
        setOwnerName(v.owner_name || '');
        setOwnerMobile(v.owner_mobile || '');
        setOwnerAddress(v.owner_address || '');
        setOwnerTel(v.owner_tel || '');

        // Vehicle details
        setVehicleType(v.vehicle_type || 'open');
        setVehicleMake(v.vehicle_make || '');
        setVehicleModel(v.vehicle_model || '');
        setEngineNo(v.engine_no || '');
        setChasisNo(v.chasis_no || '');
        setPermitNo(v.permit_no || '');
        setPermitValidity(v.permit_validity ? String(v.permit_validity).slice(0, 10) : '');
        setTaxTokenNo(v.tax_token_no || '');
        setTaxTokenValidity(v.tax_token_validity ? String(v.tax_token_validity).slice(0, 10) : '');
        setTaxTokenIssuedBy(v.tax_token_issued_by || '');

        // Insurance & eWaybill
        setPolicyNo(v.insurance_policy_no || '');
        setPolicyValidity(v.insurance_validity ? String(v.insurance_validity).slice(0, 10) : '');
        setInsCompany(v.insurance_company || '');
        setInsCity(v.insurance_city || '');
        setFinanceDetail(v.finance_detail || '');

        // TDS / ITDS
        setItdsRefBranch(v.itds_ref_branch || '');
        setItdsDeclareDate(v.itds_declare_date ? String(v.itds_declare_date).slice(0, 10) : '');
        setItdsFinYear(v.itds_financial_year || '');

        setVehicleOwnerStatus('✓ Vehicle details auto-filled from master');
    };

    // Auto-cut TDS based on ITDS Declaration presence
    useEffect(() => {
        const hasItds = itdsRefBranch.trim() || itdsDeclareDate || itdsFinYear.trim();
        const autoTdsPercent = hasItds ? 0 : 2;
        
        setHireDetails(prev => {
            if (prev.tdsPercent === autoTdsPercent) return prev;
            const next = { ...prev, tdsPercent: autoTdsPercent };
            next.lessTds = Math.round(next.totalHire * ((Number(next.tdsPercent) || 0) / 100));
            next.balAmount = next.totalHire - (Number(next.advPayment) || 0) - next.lessTds;
            return next;
        });
    }, [itdsRefBranch, itdsDeclareDate, itdsFinYear]);

    useEffect(() => {
        const normalizedVehicleNo = vehicleNo.trim().toUpperCase();
        if (normalizedVehicleNo.length < 2) {
            // Batch these into one state update to avoid multiple re-renders
            setVehicleOwnerStatus('');
            setVehicleSuggestions([]);
            setShowVehicleSuggestions(false);
            return;
        }

        // Use a longer debounce and only update if component is still mounted
        let cancelled = false;
        const timeout = window.setTimeout(async () => {
            if (cancelled) return;
            try {
                const res = await fetch(`/api/vehicles?q=${encodeURIComponent(normalizedVehicleNo)}`);
                if (!res.ok || cancelled) return;

                const data = await res.json();
                if (cancelled) return;

                if (Array.isArray(data)) {
                    setVehicleSuggestions(data);
                    // Only auto-open the dropdown if user is actively focused (not on initial load)
                    if (vehicleFocusedRef.current) {
                        setShowVehicleSuggestions(data.length > 0);
                    }

                    const exactMatch = data.find((v: any) => v.vehicle_no === normalizedVehicleNo);
                    if (exactMatch) {
                        applyVehicleDetails(exactMatch);
                    } else if (data.length === 0) {
                        setVehicleOwnerStatus('⚠ Vehicle not found in master.');
                    } else {
                        setVehicleOwnerStatus('Type to search or select from list.');
                    }
                }
            } catch {
                if (!cancelled) setVehicleOwnerStatus('Failed to fetch vehicle details');
            }
        }, 500);

        return () => {
            cancelled = true;
            window.clearTimeout(timeout);
        };
    }, [vehicleNo]);

    const debouncedCnInput = useDebounce(linkedCnInput, 300);
    const debouncedBrokerName = useDebounce(brokerName, 300);

    // Debounced CN Fetch — partial match search, show all matching CNs
    useEffect(() => {
        const val = debouncedCnInput.trim().toUpperCase();
        if (val.length < 2) {
            setCnSuggestions([]);
            setShowCnSuggestions(false);
            return;
        }
        const fetchCns = async () => {
            try {
                const res = await fetch(`/api/consignments/by-cn?search=${encodeURIComponent(val)}`);
                if (!res.ok) return;
                const list = await res.json();
                const already = new Set(linkedConsignmentsRef.current.map(c => c.cn_no));
                const filtered = (list as LinkedConsignment[]).filter(c => !already.has(c.cn_no));
                setCnSuggestions(filtered);
                setShowCnSuggestions(filtered.length > 0);
            } catch { /* silent */ }
        };
        fetchCns();
    }, [debouncedCnInput]);

    // Debounced Broker Fetch
    useEffect(() => {
        const val = debouncedBrokerName.trim();
        if (val.length < 2 || engagementType === 'direct') {
            setBrokerSuggestions([]);
            setShowBrokerSuggestions(false);
            return;
        }
        // Only fetch if we don't already have an exact matched broker selected
        if (brokerId && brokerName === val) return;

        const fetchBrokers = async () => {
            setBrokerFetching(true);
            try {
                const res = await fetch(`/api/brokers?q=${encodeURIComponent(val)}`);
                const list = await res.json();
                if (Array.isArray(list)) {
                    setBrokerSuggestions(list);
                    // Only auto-open the dropdown if user is actively focused (not on initial load)
                    if (brokerFocusedRef.current) {
                        setShowBrokerSuggestions(list.length > 0);
                    }
                    if (list.length === 0) setBrokerStatus('No broker found');
                    else setBrokerStatus(`${list.length} brokers found`);
                }
            } catch {
                setBrokerStatus('Error fetching brokers');
            } finally {
                setBrokerFetching(false);
            }
        };
        fetchBrokers();
    }, [debouncedBrokerName, engagementType, brokerId]);

    const updateHire = (field: string, value: number | string) => {
        setHireDetails(prev => {
            const next = { ...prev, [field]: value };
            
            // 1. If changing Rate Type, maintain current values but recalculate
            if (next.rateType === 'mt') {
                next.hire = Math.round((Number(next.chargeWeight) || 0) * (Number(next.rate) || 0));
            }

            // 2. Recalculate derived fields: Extras
            next.totalExtra = (Number(next.extraOverWeight) || 0) + (Number(next.overLength) || 0) + (Number(next.overWidth) || 0) + (Number(next.overHeight) || 0) + (Number(next.extraKmCharges) || 0) + (Number(next.unloadingCharges) || 0);
            
            // 3. Recalculate Total Hire
            next.totalHire = (Number(next.hire) || 0) + (next.totalExtra || 0) + (Number(next.detentCharges) || 0);
            
            // 4. Recalculate Final Balance and TDS
            next.lessTds = Math.round(next.totalHire * ((Number(next.tdsPercent) || 0) / 100));
            next.balAmount = next.totalHire - (Number(next.advPayment) || 0) - next.lessTds;
            
            return next;
        });
    };

    const handleAddCn = async () => {
        const cnNo = linkedCnInput.trim().toUpperCase();
        if (!cnNo) return;

        if (linkedConsignments.some((item) => item.cn_no.toUpperCase() === cnNo)) {
            toast.error('CN already linked');
            return;
        }

        try {
            // First try exact match
            const exactRes = await fetch(`/api/consignments/by-cn?cn=${encodeURIComponent(cnNo)}`);
            if (exactRes.ok) {
                const data = await exactRes.json();
                if (data && data.cn_no) {
                    setLinkedConsignments((prev) => [...prev, data]);
                    setLinkedCnInput('');
                    return;
                }
            }

            // Fall back to partial search and pick exact match if found, or first result
            const searchRes = await fetch(`/api/consignments/by-cn?search=${encodeURIComponent(cnNo)}`);
            if (searchRes.ok) {
                const list = await searchRes.json();
                if (Array.isArray(list) && list.length > 0) {
                    const already = new Set(linkedConsignments.map((c) => c.cn_no.toUpperCase()));
                    const available = list.filter((c: any) => !already.has(String(c.cn_no).toUpperCase()));
                    if (available.length === 0) {
                        toast.error('All matching CNs are already linked');
                        return;
                    }
                    // Prefer exact match, otherwise show suggestions to pick from
                    const exact = available.find((c: any) => String(c.cn_no).toUpperCase() === cnNo);
                    if (exact) {
                        setLinkedConsignments((prev) => [...prev, exact]);
                        setLinkedCnInput('');
                        return;
                    }
                    // Multiple partial matches — show dropdown so user can pick
                    setCnSuggestions(available);
                    setShowCnSuggestions(true);
                    toast.info(`${available.length} matching CN${available.length > 1 ? 's' : ''} found — pick from the list`);
                    return;
                }
            }

            toast.error(`No CN found matching "${cnNo}"`);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to fetch CN');
        }
    };

    const generatePDF = async () => {
        if (!challanNo) {
            toast.error('Save challan first to generate PDF');
            return;
        }

        try {
            const response = await fetch(`/api/challans/${editId || challanNo}/pdf`);
            if (!response.ok) throw new Error('Failed to generate PDF');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `challan-${challanNo}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            toast.success('PDF downloaded successfully');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to generate PDF');
        }
    };

    const handleSave = async () => {
        if (!vehicleNo) {
            toast.error('Vehicle Number is required');
            return;
        }

        setIsSubmitting(true);
        try {
            const body = {
                challan_no: challanNo,
                date_from: challanDate,
                origin_branch_code: originBranch,
                destination_branch_code: null,
                engagement_type: engagementType,
                vehicle_no: vehicleNo.toUpperCase(),
                driver_name: driverName,
                driver_mobile: driverMobile,
                loading_point: loadingPoint,
                destination_point: destinationPoint,

                // Owner/Broker
                owner_pan: ownerPan.toUpperCase(),
                owner_name: ownerName,
                owner_mobile: ownerMobile,
                owner_address: ownerAddress,
                owner_tel: ownerTel,
                broker_name: brokerName,
                broker_code: brokerCode,
                broker_mobile: brokerMobile,
                broker_address: brokerAddress,
                slip_no: slipNo,
                slip_date: slipDate || null,

                // Vehicle
                vehicle_type: vehicleType,
                permit_no: permitNo,
                permit_validity: permitValidity || null,
                vehicle_make: vehicleMake,
                engine_no: engineNo,
                chasis_no: chasisNo,
                tax_token_no: taxTokenNo,
                tax_token_validity: taxTokenValidity || null,
                tax_token_issued_by: taxTokenIssuedBy,
                vehicle_model: vehicleModel,

                // Insurance
                insurance_policy_no: policyNo,
                insurance_validity: policyValidity || null,
                insurance_company_name: insCompany,
                insurance_city: insCity,
                finance_detail: financeDetail,

                // ITDS
                itds_ref_branch: itdsRefBranch,
                itds_declare_date: itdsDeclareDate || null,
                itds_financial_year: itdsFinYear,

                // Driver
                driver_dl_no: driverDlNo,
                driver_dl_validity: driverDlValidity || null,
                driver_address: driverAddress,
                trip_tracking_consent: tripTracking,

                // Financials
                total_hire_amount: hireDetails.totalHire,
                extra_hire_amount: hireDetails.totalExtra,
                advance_amount: hireDetails.advPayment,
                hire_rate_per_kg: hireDetails.rate, // Repurposed for rate
                hire_amount: hireDetails.hire,
                extra_over_weight: hireDetails.extraOverWeight,
                extra_over_length: hireDetails.overLength,
                extra_over_width: hireDetails.overWidth,
                extra_over_height: hireDetails.overHeight,
                extra_km_charges: hireDetails.extraKmCharges,
                detent_charges: hireDetails.detentCharges,
                unloading_charges: hireDetails.unloadingCharges,
                total_extra_charges: hireDetails.totalExtra,
                tds_percent: hireDetails.tdsPercent,
                less_tds: hireDetails.lessTds,

                // Others
                remarks,
                linked_cn_nos: linkedConsignments.map((item) => item.cn_no)
            };

            const method = isEditMode ? 'PUT' : 'POST';
            const url = isEditMode ? `/api/challans/${editId}` : '/api/challans';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.error || `Failed to ${isEditMode ? 'update' : 'save'} challan`);
            }

            toast.success(`Challan ${isEditMode ? 'updated' : 'saved'} successfully!`);
            router.push('/dashboard/challans');
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to save');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Reusable field label style (matches consignment form)
    const labelCls = "text-[11px] font-bold uppercase text-muted-foreground";
    const inputCls = "h-9 text-sm";
    const redValueCls = "h-9 text-sm font-bold text-red-600 bg-transparent border-0 border-b border-slate-200 rounded-none px-1 focus-visible:ring-0 focus-visible:border-primary";

    return (
        <div className="flex flex-col min-h-screen bg-[#f8f9fa]">
            {/* Sticky Header */}
            <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b">
                <div className="max-w-[1920px] mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard/challans">
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-primary/10">
                                <ArrowLeft className="h-5 w-5 text-primary" />
                            </Button>
                        </Link>
                        <div>
                            <h1 className="text-lg font-bold tracking-tight">
                                {isLoading ? 'Loading...' : isEditMode ? 'Edit Challan' : 'New Challan'}
                            </h1>
                            <p className="text-xs text-muted-foreground font-medium">
                                {isEditMode ? (
                                    <>Challan No. <span className="text-primary font-bold">{challanNo || '---'}</span></>
                                ) : (
                                    <>Next Challan No. <span className="text-primary font-bold">{challanNo || '---'}</span></>
                                )}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={handleReset} className="gap-2 h-9 text-sm" disabled={isLoading}>
                            <RotateCcw className="h-4 w-4" /> Reset
                        </Button>
                        <Button onClick={handleSave} disabled={isSubmitting || isLoading} className="gap-2 h-9 shadow-lg shadow-primary/20 text-sm">
                            <Save className="h-4 w-4" /> {isSubmitting ? 'Saving...' : isEditMode ? 'Update' : 'Save Challan'}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex-1 p-4 md:p-6 max-w-[1920px] mx-auto w-full">
                <Tabs defaultValue="challan-details" className="w-full">
                    <TabsList className="w-full justify-start h-10 bg-slate-100 p-1 rounded-lg mb-4">
                        <TabsTrigger value="challan-details" className="gap-2 px-6 h-8 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                            <FileText className="h-3.5 w-3.5" /> Challan Details
                        </TabsTrigger>
                        <TabsTrigger value="consignment-list" className="gap-2 px-6 h-8 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                            Consignment List
                        </TabsTrigger>
                        <TabsTrigger value="vehicle-challan-list" className="gap-2 px-6 h-8 text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                            Vehicle Challan List
                        </TabsTrigger>
                    </TabsList>

                    {/* ===================== CHALLAN DETAILS TAB ===================== */}
                    <TabsContent value="challan-details">
                        <div className="space-y-5">


                            {/* ---- SECTION 1: General Details ---- */}
                            <Card className="border-none shadow-md overflow-visible bg-white">
                                <CardHeader className="bg-primary/5 py-3 px-6 border-b">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                                        <Info className="h-4 w-4" /> General Details
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 md:p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Challan Branch</Label>
                                            <Select value={originBranch} onValueChange={setOriginBranch} disabled={branches.length === 0}>
                                                <SelectTrigger className={inputCls + " bg-slate-50"}>
                                                    <SelectValue placeholder={branches.length === 0 ? "Loading..." : "Select Branch"} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {branches.map(b => (
                                                        <SelectItem key={b.code} value={b.code}>{b.code} - {b.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1 lg:col-span-2">
                                            <Label className={labelCls}>Challan Date & Time</Label>
                                            <div className="flex gap-2">
                                                <Input type="date" className={inputCls + " flex-1"} value={challanDate} onChange={(e) => setChallanDate(e.target.value)} />
                                                <Input type="time" className={inputCls + " w-28"} value={challanTime} onChange={(e) => setChallanTime(e.target.value)} />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Challan No</Label>
                                            <Input className={inputCls + " font-mono font-bold bg-yellow-50/60 border-yellow-200"} value={challanNo} onChange={(e) => setChallanNo(e.target.value)} placeholder="Auto Generated" />
                                        </div>
                                        <div className="space-y-1 lg:col-span-2 relative">
                                            <Label className={labelCls}>Vehicle No</Label>
                                            <Input
                                                className={inputCls + " uppercase"}
                                                value={vehicleNo}
                                                onChange={(e) => setVehicleNo(e.target.value.toUpperCase())}
                                                onFocus={() => { vehicleFocusedRef.current = true; if (vehicleSuggestions.length > 0) setShowVehicleSuggestions(true); }}
                                                onBlur={() => setTimeout(() => { vehicleFocusedRef.current = false; setShowVehicleSuggestions(false); }, 200)}
                                                placeholder="Type to search Vehicle No."
                                                autoComplete="off"
                                            />
                                            {showVehicleSuggestions && vehicleSuggestions.length > 0 && (
                                                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                                                    {vehicleSuggestions.map((v) => (
                                                        <button
                                                            key={v.id}
                                                            type="button"
                                                            className="w-full text-left px-3 py-2 text-xs hover:bg-primary/5 border-b last:border-b-0 flex flex-col gap-1"
                                                            onMouseDown={() => {
                                                                setVehicleNo(v.vehicle_no);
                                                                applyVehicleDetails(v);
                                                                setVehicleSuggestions([]);
                                                                setShowVehicleSuggestions(false);
                                                            }}
                                                        >
                                                            <div className="flex justify-between items-center">
                                                                <span className="font-mono font-bold text-primary">{v.vehicle_no}</span>
                                                                <span className="text-muted-foreground uppercase">{v.vehicle_type}</span>
                                                            </div>
                                                            <div className="text-slate-500 truncate">{v.owner_name} {v.owner_mobile ? `(${v.owner_mobile})` : ''}</div>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                            {vehicleOwnerStatus && <p className="text-[11px] text-muted-foreground mt-1">{vehicleOwnerStatus}</p>}
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Loading Point</Label>
                                            <Input className={inputCls} value={loadingPoint} onChange={(e) => setLoadingPoint(e.target.value)} placeholder="e.g. VERNA GOA" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Destination Point</Label>
                                            <Input className={inputCls} value={destinationPoint} onChange={(e) => setDestinationPoint(e.target.value)} placeholder="e.g. MUMBAI" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* ---- LINKED CNS ---- */}
                            <Card className="border-none shadow-md overflow-visible bg-white">
                                <CardHeader className="bg-primary/5 py-3 px-6 border-b">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                                        <Link2 className="h-4 w-4" /> Linked CNS Numbers
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 md:p-6 space-y-4">
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <div className="relative flex-1">
                                            <Input
                                                className={inputCls + " font-mono uppercase"}
                                                value={linkedCnInput}
                                                onChange={(e) => setLinkedCnInput(e.target.value.toUpperCase())}
                                                onFocus={() => { if (cnSuggestions.length > 0) setShowCnSuggestions(true); }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') { e.preventDefault(); handleAddCn(); }
                                                    if (e.key === 'Escape') setShowCnSuggestions(false);
                                                }}
                                                onBlur={() => setTimeout(() => setShowCnSuggestions(false), 150)}
                                                placeholder="Type CN number to search..."
                                            />
                                            {showCnSuggestions && cnSuggestions.length > 0 && (
                                                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg overflow-hidden">
                                                    {cnSuggestions.map((cn) => {
                                                        const weight = cn.charged_weight || cn.actual_weight || 0;
                                                        return (
                                                            <button
                                                                key={cn.id}
                                                                type="button"
                                                                className="w-full text-left px-3 py-2 text-xs hover:bg-primary/5 border-b last:border-b-0 flex items-center justify-between gap-4"
                                                                onMouseDown={() => {
                                                                    setLinkedConsignments(prev => [...prev, cn]);
                                                                    setLinkedCnInput('');
                                                                    setCnSuggestions([]);
                                                                    setShowCnSuggestions(false);
                                                                }}
                                                            >
                                                                <span className="font-mono font-bold text-primary">{cn.cn_no}</span>
                                                                <span className="text-muted-foreground truncate flex-1 mx-2">{cn.goods_desc || cn.goods_class || '---'}</span>
                                                                <span className="font-mono text-slate-500 shrink-0">{weight} {cn.load_unit || 'KG'}</span>
                                                                <span className="text-slate-400 shrink-0">{cn.delivery_point || cn.dest_branch || ''}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            {showCnSuggestions && cnSuggestions.length === 0 && linkedCnInput.length >= 2 && (
                                                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg px-3 py-2 text-xs text-muted-foreground">
                                                    No matching CNs found
                                                </div>
                                            )}
                                        </div>
                                        <Button type="button" onClick={handleAddCn} className="gap-2">
                                            <Link2 className="h-4 w-4" /> Add CNS
                                        </Button>
                                    </div>

                                    <div className="overflow-x-auto rounded-md border">
                                        <div className="min-w-[920px]">
                                            <div className="grid grid-cols-[70px_150px_180px_150px_1fr_120px_160px_48px] gap-3 bg-slate-50 px-3 py-2 text-[10px] font-bold uppercase text-muted-foreground border-b">
                                                <div>Sr No</div>
                                                <div>CNS No</div>
                                                <div>Package Details</div>
                                                <div>Type Of Package</div>
                                                <div>Material Details</div>
                                                <div>Weight</div>
                                                <div>Destination</div>
                                                <div></div>
                                            </div>
                                            {linkedConsignments.length === 0 ? (
                                                <div className="px-3 py-6 text-sm text-muted-foreground text-center">
                                                    No CNS numbers linked.
                                                </div>
                                            ) : linkedConsignments.map((cn, index) => {
                                                const packageSummary = (cn.packages || [])
                                                    .map((pkg) => `${pkg.qty || 0} ${pkg.method || 'Pkg'}`)
                                                    .join(', ');
                                                const packageTypes = Array.from(new Set((cn.packages || []).map((pkg) => pkg.method).filter(Boolean))).join(', ');
                                                const weight = cn.charged_weight || cn.actual_weight || 0;

                                                return (
                                                    <div key={cn.id} className="grid grid-cols-[70px_150px_180px_150px_1fr_120px_160px_48px] gap-3 px-3 py-2 text-xs border-b last:border-b-0 items-center">
                                                        <div className="font-mono">{index + 1}</div>
                                                        <div className="font-mono font-bold text-primary">{cn.cn_no}</div>
                                                        <div>{packageSummary || `${cn.no_of_pkg || 0} packages`}</div>
                                                        <div>{packageTypes || cn.goods_class || '---'}</div>
                                                        <div className="truncate" title={cn.goods_desc || cn.goods_class || ''}>{cn.goods_desc || cn.goods_class || '---'}</div>
                                                        <div className="font-mono">{weight} {cn.load_unit || 'KG'}</div>
                                                        <div className="truncate" title={cn.delivery_point || cn.dest_branch || ''}>{cn.delivery_point || cn.dest_branch || '---'}</div>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-destructive"
                                                            onClick={() => {
                                                                setLinkedConsignments((prev) => prev.filter((item) => item.id !== cn.id));
                                                            }}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>


                            {/* ---- SECTION 3: Broker & Owner Information ---- */}
                            <Card className="border-none shadow-md overflow-visible bg-white">
                                <CardHeader className="bg-primary/5 py-3 px-6 border-b">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                                        <Users className="h-4 w-4" /> Broker & Owner Information
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 md:p-6 space-y-6">

                                    {/* Engagement Type selector */}
                                    <div className="flex items-center gap-4">
                                        <Label className={labelCls + " min-w-[120px]"}>Engaged Via</Label>
                                        <Select value={engagementType} onValueChange={(v) => {
                                            setEngagementType(v as 'broker' | 'direct');
                                            if (v === 'direct') {
                                                setBrokerId(''); setBrokerName(''); setBrokerCode('');
                                                setBrokerAddress(''); setBrokerStatus('');
                                            }
                                        }}>
                                            <SelectTrigger className={inputCls + " w-40"}>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="broker">Broker</SelectItem>
                                                <SelectItem value="direct">Direct</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        {/* Broker Side */}
                                        <div className="space-y-4 border rounded-md p-4 bg-slate-50/50">
                                            <p className={labelCls + " mb-1"}>Broker Details</p>
                                            <div className="grid grid-cols-1 gap-4">
                                                <div className="space-y-1">
                                                    <Label className={labelCls}>Broker Name</Label>
                                                    <div className="relative">
                                                        <Input
                                                            className={inputCls + (engagementType === 'direct' ? ' bg-slate-100 opacity-60' : '')}
                                                            value={brokerName}
                                                            disabled={engagementType === 'direct'}
                                                            onChange={(e) => {
                                                                setBrokerName(e.target.value);
                                                                setBrokerId(''); setBrokerCode(''); setBrokerAddress('');
                                                                setBrokerStatus('');
                                                            }}
                                                            onFocus={() => { brokerFocusedRef.current = true; if (brokerSuggestions.length > 0) setShowBrokerSuggestions(true); }}
                                                            onBlur={() => setTimeout(() => { brokerFocusedRef.current = false; setShowBrokerSuggestions(false); }, 200)}
                                                            placeholder={engagementType === 'direct' ? 'Not applicable' : 'Type broker name to search...'}
                                                            autoComplete="off"
                                                        />
                                                        {brokerFetching && <span className="absolute right-2 top-2 text-[10px] text-muted-foreground animate-pulse">Searching...</span>}
                                                        
                                                        {showBrokerSuggestions && brokerSuggestions.length > 0 && (
                                                            <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                                                                {brokerSuggestions.map((b) => (
                                                                    <button
                                                                        key={b.id}
                                                                        type="button"
                                                                        className="w-full text-left px-3 py-2 text-xs hover:bg-primary/5 border-b last:border-b-0 flex flex-col gap-1"
                                                                        onMouseDown={() => {
                                                                            setBrokerId(b.id);
                                                                            setBrokerName(b.name);
                                                                            setBrokerCode(b.code);
                                                                            setBrokerMobile(b.mobile || '');
                                                                            setBrokerAddress(b.address || '');
                                                                            setBrokerStatus('Broker details auto-filled');
                                                                            setBrokerSuggestions([]);
                                                                            setShowBrokerSuggestions(false);
                                                                        }}
                                                                    >
                                                                        <div className="font-bold text-primary">{b.name} <span className="text-muted-foreground text-[10px] ml-1">({b.code})</span></div>
                                                                        <div className="text-slate-500 truncate">{b.mobile} {b.address ? `- ${b.address}` : ''}</div>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {brokerStatus && <p className="text-[11px] text-muted-foreground">{brokerStatus}</p>}
                                                </div>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1">
                                                        <Label className={labelCls}>Broker Code</Label>
                                                        <Input className={inputCls + " bg-slate-100 font-mono"} value={brokerCode} readOnly disabled={engagementType === 'direct'} placeholder="Auto-filled" />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className={labelCls}>Mobile <span className="text-[10px] font-normal text-primary">(editable)</span></Label>
                                                        <Input
                                                            className={inputCls}
                                                            value={brokerMobile}
                                                            onChange={(e) => setBrokerMobile(e.target.value)}
                                                            placeholder="Phone number"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className={labelCls}>Address</Label>
                                                    <Input className={inputCls + " bg-slate-100"} value={brokerAddress} readOnly disabled={engagementType === 'direct'} placeholder="Auto-filled" />
                                                </div>
                                                {/* Broker Slip fields moved here */}
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1">
                                                        <Label className={labelCls}>Broker Slip No.</Label>
                                                        <Input className={inputCls} value={slipNo} onChange={(e) => setSlipNo(e.target.value)} placeholder="Slip No" disabled={engagementType === 'direct'} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className={labelCls}>Broker Slip Date</Label>
                                                        <Input type="date" className={inputCls} value={slipDate} onChange={(e) => setSlipDate(e.target.value)} disabled={engagementType === 'direct'} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Owner Side */}
                                        <div className="space-y-4 border rounded-md p-4 bg-slate-50/50">
                                            <p className={labelCls + " mb-1"}>Vehicle Owner Details <span className="text-[10px] normal-case font-normal">(auto-filled from vehicle no.)</span></p>
                                            <div className="grid grid-cols-1 gap-4">
                                                <div className="space-y-1">
                                                    <Label className={labelCls}>Owner Name / Mobile</Label>
                                                    <div className="flex gap-2">
                                                        <Input className={inputCls + " flex-1 bg-slate-100"} value={ownerName} readOnly placeholder="Owner Name" />
                                                        <Input className={inputCls + " w-32 bg-slate-100"} value={ownerMobile} readOnly placeholder="Mobile No" />
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className={labelCls}>PAN No / Tel No</Label>
                                                    <div className="flex gap-2">
                                                        <Input className={inputCls + " flex-1 uppercase bg-slate-100"} value={ownerPan} readOnly placeholder="PAN NO." />
                                                        <Input className={inputCls + " w-32 bg-slate-100"} value={ownerTel} readOnly placeholder="TEL NO." />
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className={labelCls}>Address</Label>
                                                    <Input className={inputCls + " bg-slate-100"} value={ownerAddress} readOnly placeholder="Owner Address" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* ---- SECTION 4: Vehicle Information ---- */}
                            <Card className="border-none shadow-md overflow-hidden bg-white">
                                <CardHeader className="bg-primary/5 py-3 px-6 border-b">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                                        <Truck className="h-4 w-4" /> Vehicle Information
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 md:p-6">
                                    <p className="text-[11px] text-muted-foreground mb-4 flex items-center gap-1.5">🔒 All fields auto-filled from Vehicle Master when vehicle no is entered. Edit in <strong>Admin → Vehicle Management</strong>.</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Vehicle Type</Label>
                                            <Input className={inputCls + " bg-slate-100"} value={vehicleType} readOnly />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Permit No</Label>
                                            <Input className={inputCls + " bg-slate-100"} value={permitNo} readOnly placeholder="Auto-filled" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Permit Validity</Label>
                                            <Input type="date" className={inputCls + " bg-slate-100"} value={permitValidity} readOnly />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Vehicle Make</Label>
                                            <Input className={inputCls + " bg-slate-100"} value={vehicleMake} readOnly placeholder="Auto-filled" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Engine No</Label>
                                            <Input className={inputCls + " bg-slate-100"} value={engineNo} readOnly placeholder="Auto-filled" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Chasis No</Label>
                                            <Input className={inputCls + " bg-slate-100"} value={chasisNo} readOnly placeholder="Auto-filled" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Tax Token No</Label>
                                            <Input className={inputCls + " bg-slate-100"} value={taxTokenNo} readOnly placeholder="Auto-filled" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Tax Token Validity</Label>
                                            <Input type="date" className={inputCls + " bg-slate-100"} value={taxTokenValidity} readOnly />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Tax Token Issued By</Label>
                                            <Input className={inputCls + " bg-slate-100"} value={taxTokenIssuedBy} readOnly placeholder="Auto-filled" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Vehicle Model</Label>
                                            <Input className={inputCls + " bg-slate-100"} value={vehicleModel} readOnly placeholder="Auto-filled" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* ---- SECTION 5: Insurance ---- */}
                            <Card className="border-none shadow-md overflow-hidden bg-white">
                                <CardHeader className="bg-primary/5 py-3 px-6 border-b">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                                        <Shield className="h-4 w-4" /> Insurance Details
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 md:p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
                                        <div className="space-y-1 lg:col-span-2">
                                            <Label className={labelCls}>Policy No & Valid Date</Label>
                                            <div className="flex gap-2">
                                                <Input className={inputCls + " flex-1 bg-slate-100"} value={policyNo} readOnly placeholder="Auto-filled" />
                                                <Input type="date" className={inputCls + " w-36 bg-slate-100"} value={policyValidity} readOnly />
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Insurance Company</Label>
                                            <Input className={inputCls + " bg-slate-100"} value={insCompany} readOnly placeholder="Auto-filled" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Insurance City</Label>
                                            <Input className={inputCls + " bg-slate-100"} value={insCity} readOnly placeholder="Auto-filled" />
                                        </div>
                                        <div className="space-y-1 lg:col-span-2">
                                            <Label className={labelCls}>Finance Detail</Label>
                                            <Input className={inputCls + " bg-slate-100"} value={financeDetail} readOnly placeholder="Auto-filled" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* ---- SECTION 6: Driver Details ---- */}
                            <Card className="border-none shadow-md overflow-hidden bg-white">
                                <CardHeader className="bg-primary/5 py-3 px-6 border-b">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                                        <Users className="h-4 w-4" /> Driver Details
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 md:p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Driver DL No</Label>
                                            <Input className={inputCls} value={driverDlNo} onChange={(e) => setDriverDlNo(e.target.value)} placeholder="DL No" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Driver Name</Label>
                                            <Input className={inputCls} value={driverName} onChange={(e) => setDriverName(e.target.value)} placeholder="Driver Name" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>DL Validity Date</Label>
                                            <Input type="date" className={inputCls} value={driverDlValidity} onChange={(e) => setDriverDlValidity(e.target.value)} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Driver Mobile</Label>
                                            <Input className={inputCls} value={driverMobile} onChange={(e) => setDriverMobile(e.target.value)} placeholder="Driver Mobile" />
                                        </div>
                                        <div className="space-y-1 lg:col-span-2">
                                            <Label className={labelCls}>Driver Address</Label>
                                            <Input className={inputCls} value={driverAddress} onChange={(e) => setDriverAddress(e.target.value)} placeholder="Driver Address" />
                                        </div>
                                        <div className="flex items-end pb-1 h-9 space-y-1">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <Checkbox checked={tripTracking} onCheckedChange={(checked) => setTripTracking(!!checked)} />
                                                <span className="text-xs font-bold text-slate-700">Trip Tracking Consent?</span>
                                            </label>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* ---- SECTION 7: Owner ITDS 194C Declaration ---- */}
                            <Card className="border-none shadow-md overflow-hidden bg-white">
                                <CardHeader className="bg-yellow-50 py-3 px-6 border-b border-yellow-200">
                                    <CardTitle className="text-sm font-bold text-red-700">
                                        Owner ITDS 194C Declaration Information
                                    </CardTitle>
                                    <p className="text-xs text-green-700 font-bold mt-1">
                                        Ref. Branch:&lt;&lt; Branch Code & Name&gt;&gt; Declare Date:&lt;&lt; Date &gt;&gt; Fin Year : &lt;&lt; Declare Year &gt;&gt;
                                    </p>
                                </CardHeader>
                                <CardContent className="p-4 md:p-6 bg-yellow-50/30">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Ref Branch</Label>
                                            <Input className={inputCls + " bg-white"} placeholder="Branch Code & Name" value={itdsRefBranch} onChange={(e) => setItdsRefBranch(e.target.value)} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Declare Date</Label>
                                            <Input type="date" className={inputCls + " bg-white"} value={itdsDeclareDate} onChange={(e) => setItdsDeclareDate(e.target.value)} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Financial Year</Label>
                                            <Input className={inputCls + " bg-white"} placeholder="2025-2026" value={itdsFinYear} onChange={(e) => setItdsFinYear(e.target.value)} />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* ---- SECTION 8: Hire Details ---- */}
                            <Card className="border-none shadow-md overflow-hidden bg-white">
                                <CardHeader className="bg-primary/5 py-3 px-6 border-b">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                                        <CreditCard className="h-4 w-4" /> Hire Details
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 md:p-6 space-y-6">
                                    {/* 1. Metrics Row (CNs / Packaging / Weight) */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-b pb-4">
                                        <div className="space-y-1">
                                            <Label className={labelCls}>No Of CNs</Label>
                                            <Input type="text" inputMode="numeric" className={inputCls + " bg-slate-50"} value={hireDetails.noOfCns} readOnly />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>No Of Package</Label>
                                            <Input type="text" inputMode="numeric" className={inputCls + " bg-slate-50"} value={hireDetails.noOfPackage} readOnly />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Actual Weight (MT)</Label>
                                            <Input type="text" inputMode="numeric" className={inputCls + " bg-slate-50"} value={hireDetails.actualWeight} readOnly />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Charged Weight (MT)</Label>
                                            <Input type="text" inputMode="numeric" className={inputCls} placeholder="Enter Weight"
                                                value={hireDetails.chargeWeight}
                                                onChange={(e) => updateHire('chargeWeight', Number(e.target.value))} />
                                        </div>
                                    </div>

                                    {/* 2. Rates & Core Hire Row */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-slate-50/50 p-4 rounded-md border">
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Rate Type</Label>
                                            <Select value={hireDetails.rateType} onValueChange={(v) => updateHire('rateType', v)}>
                                                <SelectTrigger className={inputCls + " bg-white"}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="mt">Per MT</SelectItem>
                                                    <SelectItem value="fixed">Fixed</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {hireDetails.rateType === 'mt' ? (
                                            <div className="space-y-1">
                                                <Label className={labelCls}>Rate (Per MT)</Label>
                                                <Input type="text" inputMode="numeric" className={inputCls + " bg-white"} placeholder="0.00"
                                                    value={hireDetails.rate}
                                                    onChange={(e) => updateHire('rate', Number(e.target.value))} />
                                            </div>
                                        ) : (
                                            <div className="flex items-end pb-2 h-full">
                                                <span className="text-xs italic text-muted-foreground">Enter lump sum amount in Hire field directly.</span>
                                            </div>
                                        )}

                                        <div className="space-y-1">
                                            <Label className={labelCls + " text-primary"}>Hire (Rs.)</Label>
                                            {hireDetails.rateType === 'mt' ? (
                                                <div className={redValueCls + " font-bold text-lg px-3 bg-white border rounded-md flex items-center h-9"}>
                                                    {hireDetails.hire}
                                                </div>
                                            ) : (
                                                <Input type="text" inputMode="numeric" className={redValueCls + " bg-white font-bold text-lg"} placeholder="Enter Hire Amt"
                                                    value={hireDetails.hire}
                                                    onChange={(e) => updateHire('hire', Number(e.target.value))} />
                                            )}
                                        </div>
                                    </div>

                                    {/* 3. Additional Charges */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Over Length (Rs.)</Label>
                                            <Input type="text" inputMode="numeric" className={inputCls} placeholder="0"
                                                value={hireDetails.overLength}
                                                onChange={(e) => updateHire('overLength', Number(e.target.value))} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Over Height (Rs.)</Label>
                                            <Input type="text" inputMode="numeric" className={inputCls} placeholder="0"
                                                value={hireDetails.overHeight}
                                                onChange={(e) => updateHire('overHeight', Number(e.target.value))} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Over Width (Rs.)</Label>
                                            <Input type="text" inputMode="numeric" className={inputCls} placeholder="0"
                                                value={hireDetails.overWidth}
                                                onChange={(e) => updateHire('overWidth', Number(e.target.value))} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Extra KM Charges (Rs.)</Label>
                                            <Input type="text" inputMode="numeric" className={inputCls} placeholder="0"
                                                value={hireDetails.extraKmCharges}
                                                onChange={(e) => updateHire('extraKmCharges', Number(e.target.value))} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Detention Charge</Label>
                                            <Input type="text" inputMode="numeric" className={inputCls} placeholder="0"
                                                value={hireDetails.detentCharges}
                                                onChange={(e) => updateHire('detentCharges', Number(e.target.value))} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Extra Weight (Rs.)</Label>
                                            <Input type="text" inputMode="numeric" className={inputCls} placeholder="0"
                                                value={hireDetails.extraOverWeight}
                                                onChange={(e) => updateHire('extraOverWeight', Number(e.target.value))} />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Unloading Charges</Label>
                                            <Input type="text" inputMode="numeric" className={inputCls} placeholder="0"
                                                value={hireDetails.unloadingCharges}
                                                onChange={(e) => updateHire('unloadingCharges', Number(e.target.value))} />
                                        </div>
                                    </div>

                                    {/* 4. Final Totals / Payment Row */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-primary/5 p-4 rounded-lg border border-primary/10 mt-4">
                                        <div className="space-y-1 bg-white p-2 rounded shadow-sm">
                                            <Label className={labelCls + " text-primary"}>Total Hire</Label>
                                            <div className="font-black text-xl text-primary">₹{hireDetails.totalHire.toLocaleString()}</div>
                                        </div>

                                        <div className="space-y-1">
                                            <Label className={labelCls}>Advance Payment</Label>
                                            <Input type="text" inputMode="numeric" className={inputCls + " bg-white font-bold text-green-700"}
                                                value={hireDetails.advPayment}
                                                onChange={(e) => updateHire('advPayment', Number(e.target.value))} />
                                        </div>

                                        <div className="space-y-1">
                                            <Label className={labelCls}>TDS Deduction</Label>
                                            <div className="flex gap-2 items-center">
                                                <div className="relative flex-1">
                                                    <Input type="text" inputMode="numeric" className={inputCls + " bg-white pr-6"}
                                                        value={hireDetails.tdsPercent}
                                                        onChange={(e) => updateHire('tdsPercent', Number(e.target.value))} />
                                                    <span className="absolute right-2 top-2 text-xs text-slate-400">%</span>
                                                </div>
                                                <span className="text-xs font-bold">=</span>
                                                <div className="font-bold text-red-600 flex-1">₹{hireDetails.lessTds.toLocaleString()}</div>
                                            </div>
                                        </div>

                                        <div className="space-y-1 bg-yellow-50 p-2 rounded shadow-sm border border-yellow-200">
                                            <Label className={labelCls + " text-red-800"}>Balance Payment</Label>
                                            <div className="font-black text-xl text-red-700">₹{hireDetails.balAmount.toLocaleString()}</div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* ---- SECTION 9: Other Information ---- */}
                            <Card className="border-none shadow-md overflow-hidden bg-white">
                                <CardHeader className="bg-primary/5 py-3 px-6 border-b">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                                        <Info className="h-4 w-4" /> Other Information
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-4 md:p-6">
                                    <div className="grid grid-cols-1 md:grid-cols-1 gap-x-6 gap-y-4">
                                        <div className="space-y-1">
                                            <Label className={labelCls}>Remarks</Label>
                                            <Input className={inputCls} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Remarks" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Bottom Action Bar */}
                            <div className="flex justify-end gap-3 py-4">
                                <Button type="button" variant="outline" onClick={() => router.back()} className="min-w-[100px]">Cancel</Button>
                                <Button type="button" variant="outline" onClick={handleReset} className="gap-2"><RotateCcw className="h-4 w-4" /> Reset</Button>
                                <Button onClick={handleSave} disabled={isSubmitting} className="gap-2 min-w-[140px] shadow-lg shadow-primary/20">
                                    <Save className="h-4 w-4" /> {isSubmitting ? 'Saving...' : 'Save Challan'}
                                </Button>
                            </div>

                        </div>
                    </TabsContent>

                    {/* ===================== CONSIGNMENT LIST TAB ===================== */}
                    <TabsContent value="consignment-list">
                        <Card className="border-none shadow-md bg-white">
                            <CardContent className="p-6">
                                <p className="text-sm text-muted-foreground">Consignment list will appear here after saving the challan.</p>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* ===================== VEHICLE CHALLAN LIST TAB ===================== */}
                    <TabsContent value="vehicle-challan-list">
                        <Card className="border-none shadow-md bg-white">
                            <CardContent className="p-6">
                                <p className="text-sm text-muted-foreground">Vehicle challan list will appear here after saving the challan.</p>
                            </CardContent>
                        </Card>
                    </TabsContent>

                </Tabs>
            </div>
        </div>
    );
}

export default function NewChallanPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-screen">Loading form details...</div>}>
            <NewChallanPageContent />
        </Suspense>
    );
}

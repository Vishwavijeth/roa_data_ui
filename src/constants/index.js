// ── Parameter definitions ─────────────────────────────────────────────────────
export const PARAMETERS = [
    { id: 'saleprice', label: 'Sale Price', endpoint: 'sale_price', skyslopeKey: 'skyslope_sale_price', beKey: 'be_sale_price' },
    { id: 'status', label: 'Status', endpoint: 'status', skyslopeKey: 'skyslope_status', beKey: 'be_status' },
    { id: 'close_date', label: 'Close Date', endpoint: 'close_date', skyslopeKey: 'skyslope_close_date', beKey: 'be_close_date' },
    { id: 'listingprice', label: 'Listing Price', endpoint: 'listing_price', skyslopeKey: 'skyslope_listing_price', beKey: 'be_listing_price' },
    { id: 'contract_date', label: 'Contract Date', endpoint: 'contract_date', skyslopeKey: 'skyslope_contract_date', beKey: 'be_contract_date' },
    { id: 'buyer_name', label: 'Buyer Name', endpoint: 'buyer_name', skyslopeKey: 'skyslope_buyer_name', beKey: 'be_buyer_name' },
    { id: 'seller_name', label: 'Seller Name', endpoint: 'seller_name', skyslopeKey: 'skyslope_seller_name', beKey: 'be_seller_name' },
    { id: 'buying_agent_name', label: 'Buying Agent Name', endpoint: 'buying_agent_name', skyslopeKey: 'skyslope_buying_agent_name', beKey: 'be_buying_agent_name' },
    { id: 'gross_commission', label: 'Gross Commission', endpoint: 'gross_commission', skyslopeKey: 'skyslope_gross_commission', beKey: 'be_gross_commission' },
    { id: 'reviewer_specialist', label: 'Reviewer & Specialist', endpoint: 'transaction_reviewer_mapping', skyslopeKey: 'skyslope_reviewer_name', beKey: 'be_transaction_specialist' },
    { id: 'title_company', label: 'Title Company', endpoint: 'title_company', skyslopeKey: 'skyslope_title_company', beKey: 'be_title_company' }
];

export const API_BASE = 'https://roa-data-backend.vercel.app/compare';
export const BE_API = 'https://roa-data-backend.vercel.app/brokerage_engine';
export const SKYSLOPE_API = 'https://roa-data-backend.vercel.app/skyslope_api';
export const SS_API = 'https://roa-data-backend.vercel.app/skyslope_api';
export const TXN_SPECIALIST_API = 'https://roa-data-backend.vercel.app/transaction_specialist_listing';
export const REVIEWER_API = 'https://roa-data-backend.vercel.app/reviewer-listing';
export const REVIEWER_FILTERS_API = 'https://roa-data-backend.vercel.app/reviewers/filters';
export const TXN_SPECIALIST_SUMMARY_API = 'https://roa-data-backend.vercel.app/transaction_specialist_dashboard';
export const REVIEWER_SUMMARY_API = 'https://roa-data-backend.vercel.app/reviewer-dashboard';
export const CHECKLIST_TYPE_MAPPING_API = 'https://roa-data-backend.vercel.app/checklist-type-validation';
export const CHECKLIST_TYPE_MAPPING_FILTERS_API = 'https://roa-data-backend.vercel.app/checklist-type-validation/filters';
export const COMMISSION_ADVANCES_SUMMARY_API = 'https://roa-data-backend.vercel.app/commission-advances/summary';
export const COMMISSION_ADVANCES_LISTING_API = 'https://roa-data-backend.vercel.app/commission-advances/listing';
export const COMMISSION_ADVANCES_DETAIL_API = 'https://roa-data-backend.vercel.app/commission-advances/detail';
export const COMMISSION_ADVANCES_DROPDOWN_API = 'https://roa-data-backend.vercel.app/commission-advances/log-dropdown';
export const COMMISSION_ADVANCES_SUGGESTIONS_API = 'https://roa-data-backend.vercel.app/commission-advances/agent-suggestions';
export const COMMISSION_ADVANCES_ADDRESS_SUGGESTIONS_API = 'https://roa-data-backend.vercel.app/commission-advances/address-suggestions';
export const COMMISSION_ADVANCES_LOG_API = 'http://127.0.0.1:8000/commission-advances/log';

export const ROWS_PER_PAGE = 50;

export const getResult = (row) => {
    const v = row.match_result;
    if (!v || v === 'null') return '';
    return v.toLowerCase();
};

// ── Detail Section Map ────────────────────────────────────────────────────────
export const DETAIL_SECTION_MAP = [
    {
        title: 'Property',
        color: '#0ea5e9',
        keys: ['property_address', 'propertyaddress', 'address', 'property_type', 'type', 'mls_area'],
    },
    {
        title: 'Financials',
        color: '#10b981',
        keys: ['sale_price', 'listing_price', 'gross_commission', 'mls_number', 'mlsnumber', 'commission', 'price', 'list_price', 'sales_price', 'listing_amount'],
    },
    {
        title: 'Parties',
        color: '#8b5cf6',
        keys: ['buyer', 'seller', 'buyer_name', 'seller_name', 'buyer_agent_name', 'buyer_agent_email', 'buying_agent_name', 'buying_agent_email', 'selling_agent_name', 'selling_agent_email', 'reviewer', 'reviewer_name', 'transaction_specialist'],
    },
    {
        title: 'Dates',
        color: '#f59e0b',
        keys: [
            'close_date', 'closed_date', 'closeddate',
            'contract_date', 'contractacceptancedate', 'contract_acceptance_date',
            'escrow_close_date', 'escrowclose_date', 'escrowclosingdate', 'escrow_closing_date',
            'cancel_date', 'canceldate', 'cancellation_date',
            'listing_date', 'expiration_date', 'created_date', 'updated_date', 'closing_date', 'be_closed_date',
        ],
    },
    {
        title: 'Status / Tags',
        color: '#900ba7ff',
        keys: ['status', 'tags', 'tag', 'workflow_status', 'be_workflow_status', 'ss_status', 'match_result', 'state'],
    },
    {
        title: 'Identifiers',
        color: '#ef4444',
        keys: ['saleguid', 'sale_guid', 'skyslopefileid', 'skyslope_file_id', 'transactionid', 'transaction_id', 'id', 'listing_id'],
    },
];

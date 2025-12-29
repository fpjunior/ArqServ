const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const pool = require('../config/database');

/**
 * Advanced Search Endpoint
 * GET /api/search/advanced
 * 
 * Query Parameters:
 * - municipalityCode: string (required)
 * - query: string (optional) - search term for title/name
 * - year: number (optional) - filter by year
 * - documentType: 'server' | 'financial' | 'all' (optional)
 * - gender: 'M' | 'F' | 'all' (optional) - for server documents
 * - dateFrom: string (optional) - ISO date
 * - dateTo: string (optional) - ISO date
 */
router.get('/advanced', authenticate, async (req, res) => {
    try {
        const {
            municipalityCode,
            query,
            year,
            documentType = 'all',
            gender,
            dateFrom,
            dateTo
        } = req.query;

        console.log('🔍 [SEARCH] Advanced search request:', req.query);

        if (!municipalityCode) {
            return res.status(400).json({
                success: false,
                message: 'Municipality code is required'
            });
        }

        const results = [];



        // Search in server documents if type is 'server' or 'all'
        if (documentType === 'server' || documentType === 'all') {

            const { data: serverDocs, error: serverError } = await pool.supabase
                .from('documents')
                .select(`
                    *,
                    servers:server_id (
                        name
                    )
                `)
                .eq('municipality_code', municipalityCode)
                .eq('document_type', 'servidor');

            console.log('📋 [SEARCH] Server docs fetched:', serverDocs?.length || 0);
            if (serverDocs && serverDocs.length > 0) {
                console.log('📋 [SEARCH] Sample server doc:', JSON.stringify(serverDocs[0], null, 2));
            }

            if (!serverError && serverDocs) {
                // Flatten the server name into the document object for easier filtering
                const docsWithServerName = serverDocs.map(doc => ({
                    ...doc,
                    server_name: doc.servers?.name || doc.server_name
                }));

                const filteredServerDocs = applyFilters(docsWithServerName, query, year, gender, dateFrom, dateTo);
                console.log('✅ [SEARCH] Filtered server docs:', filteredServerDocs.length);
                results.push(...filteredServerDocs.map(doc => ({
                    ...doc,
                    type: 'server'
                })));
            }
        }

        // Search in financial documents if type is 'financial' or 'all'
        if (documentType === 'financial' || documentType === 'all') {
            const { data: financialDocs, error: financialError } = await pool.supabase
                .from('documents')
                .select('*')
                .eq('municipality_code', municipalityCode)
                .eq('document_type', 'financeiro');

            console.log('📋 [SEARCH] Financial docs fetched:', financialDocs?.length || 0);

            if (!financialError && financialDocs) {
                const filteredFinancialDocs = applyFilters(financialDocs, query, year, null, dateFrom, dateTo);
                console.log('✅ [SEARCH] Filtered financial docs:', filteredFinancialDocs.length);
                results.push(...filteredFinancialDocs.map(doc => ({
                    ...doc,
                    type: 'financial'
                })));
            }
        }

        console.log(`✅ [SEARCH] Found ${results.length} results`);

        res.json({
            success: true,
            data: results,
            count: results.length
        });

    } catch (error) {
        console.error('❌ [SEARCH] Error:', error);
        res.status(500).json({
            success: false,
            message: 'Error performing search',
            error: error.message
        });
    }
});

/**
 * Apply filters to documents
 */
function applyFilters(documents, query, year, gender, dateFrom, dateTo) {
    let filtered = documents;
    console.log(`🔍 [FILTER] Starting with ${documents.length} documents`);
    console.log(`🔍 [FILTER] Query: "${query}", Year: ${year}, Gender: ${gender}`);

    // Text search filter
    if (query && query.trim()) {
        const searchTerm = query.toLowerCase();
        console.log(`🔍 [FILTER] Searching for: "${searchTerm}"`);

        filtered = filtered.filter(doc => {
            const searchTerm = query.toLowerCase();
            const titleMatch = doc.title && doc.title.toLowerCase().includes(searchTerm);
            const fileNameMatch = doc.file_name && doc.file_name.toLowerCase().includes(searchTerm);

            // Only search server_name if it's a server document (has upload_type='servidores' or document_type='servidor')
            let serverNameMatch = false;
            const isServerDoc = doc.document_type === 'servidor' || doc.upload_type === 'servidores';

            if (isServerDoc) {
                serverNameMatch = doc.server_name && doc.server_name.toLowerCase().includes(searchTerm);
            }

            return titleMatch || fileNameMatch || serverNameMatch;
        });

        console.log(`🔍 [FILTER] After text search: ${filtered.length} documents`);
    }

    // Year filter
    if (year && year !== 'all') {
        filtered = filtered.filter(doc => {
            if (doc.financial_year) {
                return doc.financial_year === parseInt(year);
            }
            // Try to extract year from created_at
            if (doc.created_at) {
                const docYear = new Date(doc.created_at).getFullYear();
                return docYear === parseInt(year);
            }
            return false;
        });
    }

    // Gender filter (for server documents)
    if (gender && gender !== 'all') {
        filtered = filtered.filter(doc => doc.gender === gender);
    }

    // Date range filter
    if (dateFrom) {
        const fromDate = new Date(dateFrom);
        filtered = filtered.filter(doc => {
            const docDate = new Date(doc.created_at);
            return docDate >= fromDate;
        });
    }

    if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999); // End of day
        filtered = filtered.filter(doc => {
            const docDate = new Date(doc.created_at);
            return docDate <= toDate;
        });
    }

    return filtered;
}

module.exports = router;

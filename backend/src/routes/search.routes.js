const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth.middleware');
const pool = require('../config/database');

/**
 * Get available search options for a municipality
 * GET /api/search/options
 */
router.get('/options', authenticate, async (req, res) => {
    try {
        const { municipalityCode } = req.query;

        if (!municipalityCode) {
            return res.status(400).json({
                success: false,
                message: 'Municipality code is required'
            });
        }

        console.log(`🔍 [SEARCH] Fetching options for municipality: ${municipalityCode}`);

        // Fetch available years from documents
        const { data: yearData, error: yearError } = await pool.supabase
            .from('documents')
            .select('financial_year, created_at')
            .eq('municipality_code', municipalityCode);

        // Fetch available document types
        const { data: typeData, error: typeError } = await pool.supabase
            .from('documents')
            .select('document_type')
            .eq('municipality_code', municipalityCode);

        if (yearError) throw yearError;
        if (typeError) throw typeError;

        // Process Years
        const years = new Set();
        if (yearData) {
            yearData.forEach(doc => {
                if (doc.financial_year) {
                    years.add(doc.financial_year);
                }
                if (doc.created_at) {
                    years.add(new Date(doc.created_at).getFullYear());
                }
            });
        }

        // Process Document Types
        const types = new Set();

        // Check for 'servidor' documents
        const { count: serverCount } = await pool.supabase
            .from('documents')
            .select('*', { count: 'exact', head: true })
            .eq('municipality_code', municipalityCode)
            .eq('document_type', 'servidor');

        // Check for 'financeiro' documents (either by type OR by having financial fields)
        const { count: financialCount } = await pool.supabase
            .from('documents')
            .select('*', { count: 'exact', head: true })
            .eq('municipality_code', municipalityCode)
            .or('document_type.eq.financeiro,financial_document_type.neq.null');

        if (serverCount > 0) {
            types.add('servidor');
        }
        if (financialCount > 0) {
            types.add('financeiro');
        }

        // Determine if Genders should be shown (only if we have server documents)
        const hasServerDocs = types.has('servidor');
        // If we have server docs, we might want to check if we actually have distinct genders, 
        // but typically just knowing we have server docs is enough to show the filter.
        // Or we could query distinct genders: .select('gender').eq('document_type', 'servidor')

        let availableGenders = [];
        if (hasServerDocs) {
            const { data: genderData } = await pool.supabase
                .from('documents')
                .select('gender')
                .eq('municipality_code', municipalityCode)
                .eq('document_type', 'servidor');

            if (genderData) {
                const updatedGenders = new Set();
                genderData.forEach(d => {
                    if (d.gender) updatedGenders.add(d.gender);
                });
                availableGenders = Array.from(updatedGenders).sort();
            }
        }

        res.json({
            success: true,
            data: {
                years: Array.from(years).sort((a, b) => b - a), // Descending
                types: Array.from(types),
                genders: availableGenders
            }
        });

    } catch (error) {
        console.error('❌ [SEARCH] Error fetching options:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching search options',
            error: error.message
        });
    }
});

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
                .eq('document_type', 'servidor')
                .is('financial_document_type', null);

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
                .or('document_type.eq.financeiro,financial_document_type.neq.null');

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

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(null);
  
  // Data States
  const [publications, setPublications] = useState([]);
  const [authorsMap, setAuthorsMap] = useState({});
  const [keywordsMap, setKeywordsMap] = useState({});
  const [journalAreaMap, setJournalAreaMap] = useState({});
  const [countries, setCountries] = useState(['All Countries']);
  const [totalResults, setTotalResults] = useState(0);
  
  // Search States
  const [advTitle, setAdvTitle] = useState('');
  const [advKeywords, setAdvKeywords] = useState('');
  const [advAuthor, setAdvAuthor] = useState('');
  const [advJournal, setAdvJournal] = useState('');
  const [advYearStart, setAdvYearStart] = useState('2000'); // Changed to 2000
  const [advYearEnd, setAdvYearEnd] = useState('2025');
  const [advCountry, setAdvCountry] = useState('All Countries');
  const [advSubjectAreas, setAdvSubjectAreas] = useState([]);
  const [termLogic, setTermLogic] = useState('AND');
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [currentPage, setCurrentPage] = useState(1);
  
  const [selectedItem, setSelectedItem] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const subjectAreasList = ['Technology', 'Environmental Sciences', 'Agriculture', 'Health Sciences', 'Social Sciences', 'Arts & Humanities', 'African Studies'];

  // Initial Load
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const { data: countryData } = await supabase
          .from('journals')
          .select('country')
          .not('country', 'is', null);
        
        if (countryData) {
          const uniqueCountries = ['All Countries', ...new Set(countryData.map(j => j.country))].sort();
          setCountries(uniqueCountries);
        }
        
        await handleSearch(1);
        setLoading(false);
      } catch (err) {
        console.error("Metadata fetch error:", err);
        setLoading(false);
      }
    };
    fetchMetadata();
  }, []);

  const handleSearch = useCallback(async (page = 1) => {
    setSearching(true);
    setError(null);
    setCurrentPage(page);
    try {
      // 1. First, check if we can do the join. If not, we'll fetch publications first then journals.
      let query = supabase
        .from('publications')
        .select(`
          *,
          journals (
            source_title,
            country
          )
        `, { count: 'exact' });

      // Build filters
      if (termLogic === 'AND') {
        if (advTitle) query = query.ilike('title', `%${advTitle.replace(/"/g, '')}%`);
        if (advYearStart) query = query.gte('year', parseInt(advYearStart));
        if (advYearEnd) query = query.lte('year', parseInt(advYearEnd));
        if (advJournal) query = query.ilike('journals.source_title', `%${advJournal}%`);
        if (advCountry !== 'All Countries') query = query.eq('journals.country', advCountry);
      } else {
        // OR Logic (Simplified: applies to Title, Journal)
        const orFilters = [];
        if (advTitle) orFilters.push(`title.ilike.%${advTitle.replace(/"/g, '')}%`);
        if (advJournal) orFilters.push(`journals.source_title.ilike.%${advJournal}%`);
        if (orFilters.length > 0) query = query.or(orFilters.join(','));
      }

      // Pagination
      const from = (page - 1) * rowsPerPage;
      const to = from + rowsPerPage - 1;
      query = query.range(from, to).order('year', { ascending: false });

      const { data, count, error: searchError } = await query;

      if (searchError) {
        // If join fails due to missing relationship, fallback to simple query
        if (searchError.code === 'PGRST200') {
          console.warn("Foreign Key relationship missing. Falling back to simple query.");
          let fallbackQuery = supabase
            .from('publications')
            .select('*', { count: 'exact' });
            
          if (advTitle) fallbackQuery = fallbackQuery.ilike('title', `%${advTitle.replace(/"/g, '')}%`);
          if (advYearStart) fallbackQuery = fallbackQuery.gte('year', parseInt(advYearStart));
          if (advYearEnd) fallbackQuery = fallbackQuery.lte('year', parseInt(advYearEnd));
          
          const { data: fData, count: fCount, error: fError } = await fallbackQuery
            .range(from, to)
            .order('year', { ascending: false });
            
          if (fError) throw fError;
          
          // Manually fetch journal info
          const sourceIds = [...new Set(fData.map(p => p.source_id))];
          const { data: jData } = await supabase.from('journals').select('source_id, source_title, country').in('source_id', sourceIds);
          const jMap = {};
          jData?.forEach(j => jMap[j.source_id] = j);
          
          setPublications(fData.map(p => ({ ...p, journals: jMap[p.source_id] })));
          setTotalResults(fCount || 0);
          data = fData; // for author/keyword fetch
        } else {
          throw searchError;
        }
      } else {
        setPublications(data);
        setTotalResults(count || 0);
      }

      // Fetch Authors and Keywords
      const ids = data.map(p => p.id);
      if (ids.length > 0) {
        const [{ data: aData }, { data: kData }, { data: areaData }] = await Promise.all([
          supabase.from('authors').select('ajol_id, author').in('ajol_id', ids),
          supabase.from('keywords').select('ajol_id, keyword').in('ajol_id', ids),
          supabase.from('journal_areas').select('source_id, area').in('source_id', data.map(p => p.source_id))
        ]);

        const aMap = {};
        aData?.forEach(row => {
          if (!aMap[row.ajol_id]) aMap[row.ajol_id] = [];
          aMap[row.ajol_id].push(row.author);
        });
        setAuthorsMap(aMap);

        const kMap = {};
        kData?.forEach(row => {
          if (!kMap[row.ajol_id]) kMap[row.ajol_id] = [];
          kMap[row.ajol_id].push(row.keyword);
        });
        setKeywordsMap(kMap);

        const areaMap = {};
        areaData?.forEach(row => {
          if (!areaMap[row.source_id]) areaMap[row.source_id] = [];
          areaMap[row.source_id].push(row.area);
        });
        setJournalAreaMap(areaMap);
      }
    } catch (err) {
      console.error("Search error:", err);
      setError("Database connection or schema error. Please ensure Foreign Keys are set up.");
    } finally {
      setSearching(false);
    }
  }, [advTitle, advYearStart, advYearEnd, advCountry, advJournal, termLogic, rowsPerPage]);

  useEffect(() => {
    if (!loading) handleSearch(currentPage);
  }, [currentPage, rowsPerPage]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-black rounded-full animate-spin mb-4"></div>
        <h2 className="text-sm font-semibold tracking-tight text-gray-900">Synchronising with Supabase...</h2>
      </div>
    );
  }

  return (
    <div className="bg-white text-gray-900 antialiased h-screen flex overflow-hidden selection:bg-gray-200 selection:text-black">
      
      {/* Left Sidebar: Search & Filters */}
      <aside className={`w-72 lg:w-80 border-r border-gray-200 flex flex-col h-full bg-gray-50/50 flex-shrink-0 transition-all ${isSidebarOpen ? 'ml-0' : '-ml-72 lg:-ml-80'} md:flex z-10 relative`}>
        <div className="h-14 border-b border-gray-200 flex items-center px-5 bg-white sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-black rounded flex items-center justify-center text-white font-semibold text-xs tracking-tight">A</div>
            <h1 className="text-base font-semibold tracking-tight text-gray-900 leading-none">AJOL Review Platform</h1>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Search Template</label>
            <div className="relative">
              <select 
                onChange={(e) => {
                  if (e.target.value === 'S2: Low-Carbon Binders') {
                    setAdvTitle('"low carbon cement" OR "LC3"');
                    setAdvKeywords('calcined clay OR geopolymer');
                    setAdvYearStart('2000');
                    setAdvYearEnd('2025');
                  } else {
                    setAdvTitle('');
                    setAdvKeywords('');
                  }
                }}
                className="w-full appearance-none bg-white border border-gray-200 rounded-md py-2 pl-3 pr-8 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-black focus:border-black cursor-pointer shadow-sm"
              >
                <option>Custom Search</option>
                <option>S1: General Sustainable Materials</option>
                <option>S2: Low-Carbon Binders</option>
              </select>
              <iconify-icon icon="solar:alt-arrow-down-linear" class="absolute right-3 top-2.5 text-gray-400 pointer-events-none" width="18"></iconify-icon>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Term Logic</label>
            </div>
            <div className="flex bg-gray-200/50 p-1 rounded-md">
              <button 
                onClick={() => setTermLogic('AND')}
                className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${termLogic === 'AND' ? 'shadow-sm bg-white text-black border border-gray-200/50' : 'text-gray-500 hover:text-gray-900'}`}
              >AND</button>
              <button 
                onClick={() => setTermLogic('OR')}
                className={`flex-1 py-1.5 text-xs font-medium rounded transition-all ${termLogic === 'OR' ? 'shadow-sm bg-white text-black border border-gray-200/50' : 'text-gray-500 hover:text-gray-900'}`}
              >OR</button>
            </div>
          </div>

          <hr className="border-gray-200 border-dashed" />

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-700">Title</label>
              <input type="text" value={advTitle} onChange={e => setAdvTitle(e.target.value)} placeholder='e.g. "low carbon"' className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-black focus:border-black shadow-sm placeholder-gray-400 transition-shadow" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-700">Keywords</label>
              <input type="text" value={advKeywords} onChange={e => setAdvKeywords(e.target.value)} placeholder="e.g. calcined clay" className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-black focus:border-black shadow-sm placeholder-gray-400 transition-shadow" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-700">Author</label>
              <input type="text" value={advAuthor} onChange={e => setAdvAuthor(e.target.value)} placeholder="e.g. Smith, J." className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-black focus:border-black shadow-sm placeholder-gray-400 transition-shadow" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-700">Journal</label>
              <div className="relative">
                <iconify-icon icon="solar:magnifer-linear" class="absolute left-3 top-2.5 text-gray-400" width="16"></iconify-icon>
                <input type="text" value={advJournal} onChange={e => setAdvJournal(e.target.value)} placeholder="Search journals..." className="w-full bg-white border border-gray-200 rounded-md pl-9 pr-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-black focus:border-black shadow-sm placeholder-gray-400 transition-shadow" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-700">Year Range</label>
              <div className="flex items-center gap-2">
                <input type="number" value={advYearStart} onChange={e => setAdvYearStart(e.target.value)} className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-black focus:border-black shadow-sm transition-shadow text-center" />
                <span className="text-gray-400 text-sm">-</span>
                <input type="number" value={advYearEnd} onChange={e => setAdvYearEnd(e.target.value)} className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-black focus:border-black shadow-sm transition-shadow text-center" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-700">Country</label>
              <div className="relative">
                <select value={advCountry} onChange={e => setAdvCountry(e.target.value)} className="w-full appearance-none bg-white border border-gray-200 rounded-md py-2 pl-3 pr-8 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-black focus:border-black cursor-pointer shadow-sm">
                  {countries.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <iconify-icon icon="solar:alt-arrow-down-linear" class="absolute right-3 top-2.5 text-gray-400 pointer-events-none" width="18"></iconify-icon>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-gray-200 bg-white flex flex-col gap-2 sticky bottom-0 z-20">
          <button onClick={() => handleSearch(1)} className="w-full bg-black text-white rounded-md py-2 text-sm font-medium hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-black transition-colors flex items-center justify-center gap-2 shadow-sm">
            {searching ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : <iconify-icon icon="solar:magnifer-linear" width="16"></iconify-icon>}
            Run Search
          </button>
          <div className="flex gap-2">
            <button className="flex-1 bg-white border border-gray-200 text-gray-700 rounded-md py-2 text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm">Save</button>
            <button 
              onClick={() => {
                setAdvTitle('');
                setAdvKeywords('');
                setAdvAuthor('');
                setAdvJournal('');
                setAdvYearStart('2000');
                setAdvYearEnd('2025');
                setAdvCountry('All Countries');
                setAdvSubjectAreas([]);
              }}
              className="flex-1 bg-white border border-gray-200 text-gray-700 rounded-md py-2 text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
            >Clear</button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-white relative z-0">
        <header className="h-14 border-b border-gray-200 flex items-center justify-between px-4 md:px-6 bg-white shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden text-gray-500 hover:text-black">
              <iconify-icon icon="solar:hamburger-menu-linear" width="24"></iconify-icon>
            </button>
            <div className="flex flex-col">
              <span className="text-lg tracking-tight font-semibold text-gray-900 leading-tight">{totalResults.toLocaleString()} Results</span>
              <span className="text-xs text-gray-500 font-medium hidden sm:block">{searching ? 'Searching Supabase...' : 'Live Database Mode'}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 border-r border-gray-200 pr-3 mr-1">
              <span className="text-xs text-gray-500 font-medium">Rows per page</span>
              <select value={rowsPerPage} onChange={e => setRowsPerPage(parseInt(e.target.value))} className="appearance-none bg-transparent text-sm font-medium text-gray-900 focus:outline-none cursor-pointer">
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
              </select>
            </div>
          </div>
        </header>

        {/* Error State */}
        {error && (
          <div className="m-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-800">
            <iconify-icon icon="solar:danger-circle-linear" width="20"></iconify-icon>
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Data Table */}
        <div className="flex-1 overflow-auto bg-white relative">
          {searching && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-20 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-black rounded-full animate-spin"></div>
            </div>
          )}
          <table className="w-full text-left border-collapse whitespace-nowrap min-w-[800px]">
            <thead className="sticky top-0 bg-white shadow-[0_1px_0_0_#e5e7eb] z-10">
              <tr>
                <th className="w-12 px-4 py-3 text-center">
                  <label className="custom-checkbox cursor-pointer inline-flex items-center">
                    <input type="checkbox" className="sr-only" />
                    <div className="w-4 h-4 border border-gray-300 rounded-sm flex items-center justify-center bg-white">
                      <iconify-icon icon="solar:check-read-linear" class="text-white hidden" width="12" stroke-width="2"></iconify-icon>
                    </div>
                  </label>
                </th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Article Title</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Year</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Journal</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Country</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Keywords (Matched)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {publications.map((item, idx) => (
                <tr 
                  key={item.id || idx} 
                  onClick={() => setSelectedItem(item)}
                  className={`hover:bg-gray-50 cursor-pointer transition-colors group ${selectedItem?.id === item.id ? 'bg-blue-50/40 hover:bg-blue-50/60' : ''}`}
                >
                  <td className="px-4 py-3.5 text-center">
                    <label className="custom-checkbox cursor-pointer inline-flex items-center">
                      <input type="checkbox" className="sr-only" checked={selectedItem?.id === item.id} readOnly />
                      <div className="w-4 h-4 border border-gray-300 rounded-sm flex items-center justify-center bg-white">
                        <iconify-icon icon="solar:check-read-linear" class="text-white hidden" width="12" stroke-width="2"></iconify-icon>
                      </div>
                    </label>
                  </td>
                  <td className="px-4 py-3.5 max-w-md truncate">
                    <span className="font-medium text-gray-900 group-hover:underline">{item.title}</span>
                    <div className="text-xs text-gray-500 mt-0.5 truncate">{(authorsMap[item.id] || []).join(', ')}</div>
                  </td>
                  <td className="px-4 py-3.5 text-gray-600">{item.year}</td>
                  <td className="px-4 py-3.5 text-gray-600 max-w-[200px] truncate">{item.journals?.source_title || 'Unknown Journal'}</td>
                  <td className="px-4 py-3.5 text-gray-600">{item.journals?.country || 'Unknown'}</td>
                  <td className="px-4 py-3.5 text-gray-500 truncate max-w-[200px]">
                    {(keywordsMap[item.id] || []).slice(0, 2).map((k, i) => (
                      <span key={i} className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-800 border border-gray-200 mr-1">
                        {k.trim()}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="h-14 border-t border-gray-200 bg-white flex items-center justify-between px-4 md:px-6 shrink-0">
          <span className="text-sm text-gray-500 font-medium">Showing {((currentPage - 1) * rowsPerPage) + 1} to {Math.min(currentPage * rowsPerPage, totalResults)} of {totalResults.toLocaleString()}</span>
          <div className="flex items-center gap-1">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="p-1.5 rounded text-gray-400 hover:text-black hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              <iconify-icon icon="solar:alt-arrow-left-linear" width="20"></iconify-icon>
            </button>
            <div className="flex items-center">
              <span className="px-4 text-sm font-medium text-gray-900">Page {currentPage} of {Math.max(1, Math.ceil(totalResults / rowsPerPage))}</span>
            </div>
            <button 
              disabled={currentPage === Math.ceil(totalResults / rowsPerPage) || totalResults === 0}
              onClick={() => setCurrentPage(p => p + 1)}
              className="p-1.5 rounded text-gray-600 hover:text-black hover:bg-gray-100 transition-colors"
            >
              <iconify-icon icon="solar:alt-arrow-right-linear" width="20"></iconify-icon>
            </button>
          </div>
        </div>
      </main>

      {/* Right Drawer: Article Detail */}
      <AnimatePresence>
        {selectedItem && (
          <motion.aside 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-full md:w-[380px] lg:w-[420px] bg-white border-l border-gray-200 shadow-[rgba(0,0,0,0.05)_-4px_0px_24px] absolute md:static right-0 top-0 h-full z-30 flex flex-col shrink-0"
          >
            <div className="h-14 border-b border-gray-200 flex items-center justify-between px-5 bg-white shrink-0">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Record Details</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setSelectedItem(null)} className="p-1.5 text-gray-400 hover:text-black rounded transition-colors" title="Close">
                  <iconify-icon icon="solar:close-circle-linear" width="20"></iconify-icon>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 md:p-6 bg-white">
              <div className="mb-6">
                <h2 className="text-[19px] leading-snug tracking-tight font-semibold text-gray-900 mb-2">
                  {selectedItem.title}
                </h2>
                <p className="text-sm text-gray-600 leading-relaxed font-medium">
                  {(authorsMap[selectedItem.id] || []).join('; ')}
                </p>
              </div>

              <div className="space-y-5">
                <div className="bg-gray-50/50 rounded-lg border border-gray-100 p-4 space-y-3">
                  <div className="flex justify-between items-baseline gap-4 border-b border-gray-100 pb-2">
                    <span className="text-xs font-medium text-gray-500 w-20 shrink-0">Journal</span>
                    <span className="text-sm text-gray-900 font-medium text-right">{selectedItem.journals?.source_title || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between items-baseline gap-4 border-b border-gray-100 pb-2">
                    <span className="text-xs font-medium text-gray-500 w-20 shrink-0">Details</span>
                    <span className="text-sm text-gray-900 text-right">{selectedItem.year} • Vol {selectedItem.volume}({selectedItem.issue}) • pp. {selectedItem.first_page}-{selectedItem.last_page}</span>
                  </div>
                  <div className="flex justify-between items-baseline gap-4 border-b border-gray-100 pb-2">
                    <span className="text-xs font-medium text-gray-500 w-20 shrink-0">Location</span>
                    <span className="text-sm text-gray-900 text-right">{selectedItem.journals?.country || 'Unknown'}</span>
                  </div>
                  <div className="flex justify-between items-baseline gap-4">
                    <span className="text-xs font-medium text-gray-500 w-20 shrink-0">Subject Areas</span>
                    <span className="text-sm text-gray-900 text-right">{(journalAreaMap[selectedItem.source_id] || []).join(', ')}</span>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Author Keywords</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {(keywordsMap[selectedItem.id] || []).map((k, i) => (
                      <span key={i} className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                        {k.trim()}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  <a href={selectedItem.article_url} target="_blank" className="flex items-center justify-between p-3 rounded-md border border-gray-200 hover:border-black hover:shadow-sm transition-all group">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-gray-500 group-hover:text-black group-hover:bg-gray-200 transition-colors">
                        <iconify-icon icon="solar:link-linear" width="18"></iconify-icon>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900 leading-none mb-1">View on AJOL</span>
                        <span className="text-[11px] text-gray-500 truncate w-48">{selectedItem.article_url}</span>
                      </div>
                    </div>
                    <iconify-icon icon="solar:arrow-right-up-linear" class="text-gray-400 group-hover:text-black" width="16"></iconify-icon>
                  </a>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

    </div>
  );
}

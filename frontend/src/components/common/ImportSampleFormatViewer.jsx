import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Copy,
  Check,
  ArrowLeft,
  Info,
  CheckCircle2,
  AlertCircle,
  Users,
  GraduationCap,
  BookOpen,
  Building2,
  Calendar,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import {
  getSampleFormatConfig,
  downloadSampleCsvFile,
  copySampleCsvToClipboard,
  IMPORT_SAMPLE_FORMATS
} from '../../utils/importSampleFormats';
import { masterDataApi } from '../../api/masterDataApi';

export default function ImportSampleFormatViewer({
  currentType = 'teachers',
  onSelectType,
  onBackToUpload
}) {
  const [selectedType, setSelectedType] = useState(currentType);
  const [copied, setCopied] = useState(false);
  const [downloadingXlsx, setDownloadingXlsx] = useState(false);
  const [downloadingCsv, setDownloadingCsv] = useState(false);

  const activeType = selectedType || currentType;
  const config = getSampleFormatConfig(activeType);

  const handleTypeChange = (typeId) => {
    setSelectedType(typeId);
    if (onSelectType) onSelectType(typeId);
  };

  const handleCopyCsv = async () => {
    const success = await copySampleCsvToClipboard(activeType);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownloadCsv = () => {
    setDownloadingCsv(true);
    try {
      downloadSampleCsvFile(activeType);
    } catch (err) {
      console.error('Failed to download CSV:', err);
    } finally {
      setTimeout(() => setDownloadingCsv(false), 500);
    }
  };

  const handleDownloadXlsx = async () => {
    setDownloadingXlsx(true);
    try {
      await masterDataApi.downloadSampleTemplate(activeType, 'xlsx');
    } catch (err) {
      console.error('Failed to download XLSX template, falling back to CSV:', err);
      downloadSampleCsvFile(activeType);
    } finally {
      setDownloadingXlsx(false);
    }
  };

  const entityTabs = [
    { id: 'teachers', label: 'Teachers', icon: <Users size={15} /> },
    { id: 'students', label: 'Students', icon: <GraduationCap size={15} /> },
    { id: 'subjects', label: 'Subjects', icon: <BookOpen size={15} /> },
    { id: 'classrooms', label: 'Classrooms', icon: <Building2 size={15} /> },
    { id: 'timetables', label: 'Timetable', icon: <Calendar size={15} /> }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Top Banner / Switcher */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '12px 16px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #EFF6FF 0%, #EEF2FF 100%)',
          border: '1px solid #BFDBFE'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: '#2563EB',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2)'
            }}
          >
            <FileSpreadsheet size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h5 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#1E293B' }}>
                Sample Data Format: {config.title}
              </h5>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: '#DBEAFE',
                  color: '#1D4ED8'
                }}
              >
                .{activeType === 'timetables' ? 'xlsx / .csv' : 'xlsx / .csv'}
              </span>
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#475569' }}>
              {config.subtitle}
            </p>
          </div>
        </div>

        {/* Quick action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {onBackToUpload && (
            <button
              type="button"
              onClick={onBackToUpload}
              className="btn btn-sm btn-outline-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 600,
                backgroundColor: '#FFFFFF',
                borderRadius: '8px',
                padding: '6px 12px'
              }}
            >
              <ArrowLeft size={14} />
              <span>Back to Upload</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyCsv}
            className="btn btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: copied ? '#ECFDF5' : '#FFFFFF',
              color: copied ? '#059669' : '#334155',
              border: copied ? '1px solid #A7F3D0' : '1px solid #CBD5E1',
              borderRadius: '8px',
              padding: '6px 12px',
              cursor: 'pointer'
            }}
            title="Copy sample CSV text to clipboard"
          >
            {copied ? <Check size={14} color="#059669" /> : <Copy size={14} />}
            <span>{copied ? 'CSV Copied!' : 'Copy Sample CSV'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={downloadingCsv}
            className="btn btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: '#FFFFFF',
              color: '#0284C7',
              border: '1px solid #BAE6FD',
              borderRadius: '8px',
              padding: '6px 12px',
              cursor: 'pointer'
            }}
            title="Download CSV spreadsheet template"
          >
            <Download size={14} />
            <span>{downloadingCsv ? 'Saving...' : 'Download .CSV'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadXlsx}
            disabled={downloadingXlsx}
            className="btn btn-sm btn-success"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 600,
              backgroundColor: '#059669',
              borderColor: '#059669',
              borderRadius: '8px',
              padding: '6px 14px',
              boxShadow: '0 2px 4px rgba(5, 150, 105, 0.2)',
              cursor: 'pointer'
            }}
            title="Download Microsoft Excel formatted template with sample rows"
          >
            <Download size={14} />
            <span>{downloadingXlsx ? 'Generating...' : 'Download Excel (.xlsx)'}</span>
          </button>
        </div>
      </div>

      {/* Entity Switcher Pills */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          paddingBottom: '2px',
          borderBottom: '1px solid #E2E8F0'
        }}
      >
        {entityTabs.map((tab) => {
          const isActive = tab.id === activeType;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTypeChange(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#2563EB' : '#64748B',
                backgroundColor: isActive ? '#EFF6FF' : 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid #2563EB' : '2px solid transparent',
                borderRadius: '6px 6px 0 0',
                padding: '8px 14px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. VISUAL SPREADSHEET PREVIEW TABLE */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
              1. Sample Spreadsheet Preview
            </span>
            <span style={{ fontSize: '11px', color: '#64748B' }}>
              (Row 1: Header names, Rows 2-5: Example records)
            </span>
          </div>
          <span style={{ fontSize: '11px', color: '#94A3B8' }}>
            * Red asterisks indicate mandatory fields
          </span>
        </div>

        <div
          style={{
            border: '1px solid #CBD5E1',
            borderRadius: '12px',
            overflow: 'hidden',
            backgroundColor: '#FFFFFF',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}
        >
          <div style={{ overflowX: 'auto', maxHeight: '220px' }}>
            <table className="table table-bordered table-sm mb-0" style={{ fontSize: '12px', minWidth: '600px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC' }}>
                  <th
                    style={{
                      width: '42px',
                      textAlign: 'center',
                      backgroundColor: '#F1F5F9',
                      color: '#64748B',
                      fontWeight: 700
                    }}
                  >
                    #
                  </th>
                  {config.columns.map((col) => (
                    <th
                      key={col.key}
                      style={{
                        padding: '10px 12px',
                        backgroundColor: '#F8FAFC',
                        color: '#0F172A',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        borderBottom: '2px solid #CBD5E1'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>{col.key}</span>
                        {col.required && (
                          <span
                            title="Required Field"
                            style={{
                              color: '#EF4444',
                              fontWeight: 900,
                              fontSize: '14px'
                            }}
                          >
                            *
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 500 }}>
                        {col.type}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {config.sampleRows.map((row, idx) => (
                  <tr
                    key={idx}
                    style={{
                      backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#FAFAFA'
                    }}
                  >
                    <td
                      style={{
                        textAlign: 'center',
                        backgroundColor: '#F8FAFC',
                        color: '#94A3B8',
                        fontWeight: 600,
                        fontSize: '11px'
                      }}
                    >
                      {idx + 2}
                    </td>
                    {config.columns.map((col) => {
                      const val = row[col.key];
                      const isEmail = col.key.toLowerCase().includes('email');
                      const isCode = col.key.toLowerCase().includes('id') || col.key.toLowerCase().includes('code') || col.key.toLowerCase().includes('enrollment');
                      return (
                        <td
                          key={col.key}
                          style={{
                            padding: '8px 12px',
                            color: '#1E293B',
                            whiteSpace: 'nowrap',
                            fontFamily: isEmail || isCode ? 'monospace' : 'inherit',
                            fontSize: isEmail || isCode ? '11px' : '12px'
                          }}
                        >
                          {val || <span style={{ color: '#CBD5E1' }}>—</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 2. FIELD SPECIFICATIONS & VALIDATION RULES */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
            2. Column Requirements & Field Rules
          </span>
          <span style={{ fontSize: '11px', color: '#64748B' }}>
            (Alternative header names and accepted values)
          </span>
        </div>

        <div
          style={{
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            overflow: 'hidden',
            backgroundColor: '#FFFFFF'
          }}
        >
          <div style={{ overflowX: 'auto', maxHeight: '280px' }}>
            <table className="table table-hover table-sm mb-0" style={{ fontSize: '12px' }}>
              <thead style={{ backgroundColor: '#F8FAFC', position: 'sticky', top: 0, zIndex: 1 }}>
                <tr>
                  <th style={{ padding: '8px 12px', color: '#475569', fontWeight: 700, width: '22%' }}>Column Header</th>
                  <th style={{ padding: '8px 12px', color: '#475569', fontWeight: 700, width: '13%' }}>Required?</th>
                  <th style={{ padding: '8px 12px', color: '#475569', fontWeight: 700, width: '15%' }}>Data Type</th>
                  <th style={{ padding: '8px 12px', color: '#475569', fontWeight: 700, width: '32%' }}>Description & Constraints</th>
                  <th style={{ padding: '8px 12px', color: '#475569', fontWeight: 700, width: '18%' }}>Example Value</th>
                </tr>
              </thead>
              <tbody>
                {config.columns.map((col, idx) => (
                  <tr key={idx}>
                    <td style={{ padding: '9px 12px' }}>
                      <div style={{ fontWeight: 700, color: '#0F172A' }}>{col.key}</div>
                      {col.aliases && col.aliases.length > 0 && (
                        <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>
                          Also accepts: {col.aliases.join(', ')}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '9px 12px' }}>
                      {col.required ? (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            backgroundColor: '#FEE2E2',
                            color: '#DC2626',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px'
                          }}
                        >
                          Required
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            backgroundColor: '#F1F5F9',
                            color: '#64748B',
                            display: 'inline-flex',
                            alignItems: 'center'
                          }}
                        >
                          Optional
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '9px 12px', color: '#334155', fontWeight: 500 }}>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: '#F8FAFC',
                          border: '1px solid #E2E8F0',
                          fontFamily: 'monospace'
                        }}
                      >
                        {col.type}
                      </span>
                    </td>
                    <td style={{ padding: '9px 12px', color: '#475569', fontSize: '11px', lineHeight: 1.4 }}>
                      {col.description}
                    </td>
                    <td style={{ padding: '9px 12px', color: '#0F172A', fontFamily: 'monospace', fontSize: '11px' }}>
                      {col.example}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 3. RULES & BEST PRACTICES */}
      <div
        style={{
          padding: '12px 16px',
          borderRadius: '12px',
          backgroundColor: '#F8FAFC',
          border: '1px solid #E2E8F0'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
          <Sparkles size={15} color="#2563EB" />
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>
            Important Validation & Import Tips
          </span>
        </div>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '11px', color: '#475569', lineHeight: 1.6 }}>
          {config.rules.map((rule, rIdx) => (
            <li key={rIdx}>{rule}</li>
          ))}
          <li>
            <strong>100% Safe Dry-Run:</strong> When you upload a file, the system first previews and validates every row without modifying database records. You can inspect valid rows, duplicates, and errors before finalizing.
          </li>
        </ul>
      </div>

      {/* Bottom Action Footer */}
      {onBackToUpload && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '8px',
            borderTop: '1px solid #F1F5F9'
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748B' }}>
            Ready to upload your spreadsheet?
          </div>
          <button
            type="button"
            onClick={onBackToUpload}
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 700,
              padding: '7px 18px',
              borderRadius: '8px'
            }}
          >
            <span>Proceed to File Upload & Validate</span>
            <ArrowLeft size={14} style={{ transform: 'rotate(180deg)' }} />
          </button>
        </div>
      )}
    </div>
  );
}

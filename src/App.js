import React, { useState, useRef } from 'react';
import './App.css';

function App() {
  const [prescriptions, setPrescriptions] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState({});
  const [purchaseNotes, setPurchaseNotes] = useState({}); // holds temporary notes per medication row
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const fileInputRef = useRef(null);

  // ================= PROJECT SERVICES (AI FEATURES) =================
  const services = [
    {
      id: 1,
      icon: "✨",
      title: "Instant AI Analysis",
      description: "Our advanced AI generates a complete health report in seconds from your prescription."
    },
    {
      id: 2,
      icon: "🧠",
      title: "Knowledge Base",
      description: "AI reads medical shorthand and dosage instructions with 99.9% accuracy."
    },
    {
      id: 3,
      icon: "📊",
      title: "Readiness Report",
      description: "Get a clear, actionable summary of your medications and safety guidelines immediately."
    },
    {
      id: 4,
      icon: "🍼",
      title: "Pregnancy Safe",
      description: "Specialized focus on maternal health and medication safety protocols."
    },
    {
      id: 5,
      icon: "🛡️",
      title: "Safety Alerts",
      description: "Instant warnings for high dosages or potentially harmful drug interactions."
    },
    {
      id: 6,
      icon: "🛒",
      title: "One-Click Pharmacy",
      description: "Direct access to trusted medicines with trackable order history."
    }
  ];



  // Handle file selection
  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    processFiles(files);
  };

  // Process selected files
  const processFiles = async (files) => {
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    imageFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const newPrescription = {
          id: Date.now() + Math.random(),
          name: file.name,
          size: formatFileSize(file.size),
          preview: e.target.result,
          uploadDate: new Date().toLocaleDateString(),
          analyzing: true
        };
        setPrescriptions(prev => [...prev, newPrescription]);

        // Analyze prescription
        await analyzePrescription(newPrescription.id, e.target.result);
      };
      reader.readAsDataURL(file);
    });
  };

  // Analyze prescription using backend API
  const analyzePrescription = async (prescriptionId, base64Image) => {
    try {
      setIsAnalyzing(true);

      // Extract base64 data without the data:image prefix
      const base64Data = base64Image.split(',')[1];

      const response = await fetch('http://localhost:5000/api/analyze-prescription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          images: [base64Data]
        })
      });

      if (response.ok) {
        const result = await response.json();
        setAnalysisResults(prev => ({
          ...prev,
          [prescriptionId]: result
        }));

        // Update prescription status
        setPrescriptions(prev => prev.map(p =>
          p.id === prescriptionId ? { ...p, analyzing: false, analyzed: true } : p
        ));

        // Save to Database
        try {
          const saveResponse = await fetch('http://localhost:5000/api/save-prescription', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(result)
          });

          if (saveResponse.ok) {
            console.log("Prescription saved to database");
          } else {
            console.warn("Failed to save prescription to database");
          }
        } catch (dbError) {
          console.error("Error saving to database:", dbError);
        }
      } else {
        console.error('Analysis failed:', await response.text());
        setPrescriptions(prev => prev.map(p =>
          p.id === prescriptionId ? { ...p, analyzing: false, error: true } : p
        ));
      }
    } catch (error) {
      console.error('Error analyzing prescription:', error);
      setPrescriptions(prev => prev.map(p =>
        p.id === prescriptionId ? { ...p, analyzing: false, error: true } : p
      ));
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Build Apollo Pharmacy search URL for a medication (includes dosage if available)
  // Prefer a path-based URL like /search-medicines/paracetamol-500mg for readability,
  // but include query params as a compatibility fallback.
  const slugify = (str) => str.toString().toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

  const buildApolloSearchUrl = (m) => {
    const name = (m?.name || '').trim();
    if (!name || name.toLowerCase() === 'not available') return null;
    let query = name;
    if (m.dosage && typeof m.dosage === 'string' && m.dosage.toLowerCase() !== 'not available') {
      // include dosage to improve search relevancy but keep it simple
      query += ` ${m.dosage.replace(/\s+/g, ' ').trim()}`;
    }
    const slug = slugify(query);
    const encoded = encodeURIComponent(query);
    return `https://www.apollopharmacy.in/search-medicines/${slug}?q=${encoded}&name=${encoded}&source=/`;
  };

  // Purchase click handler: checks Apollo search server-side and opens appropriate URL
  const handlePurchaseClick = async (prescriptionId, med, medIndex, e) => {
    e.preventDefault();
    const key = `${prescriptionId}-${medIndex}`;
    const name = (med?.name || '').trim();
    if (!name || name.toLowerCase() === 'not available') {
      setPurchaseNotes(prev => ({ ...prev, [key]: 'No product name available' }));
      return;
    }

    const query = med.dosage && med.dosage.toLowerCase() !== 'not available' ? `${name} ${med.dosage}` : name;
    setPurchaseNotes(prev => ({ ...prev, [key]: 'Checking Apollo search…' }));

    try {
      const res = await fetch('http://localhost:5000/api/check-apollo-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();

      if (data.found && data.url) {
        window.open(data.url, '_blank');
        setPurchaseNotes(prev => ({ ...prev, [key]: 'Opened Apollo Pharmacy' }));
      } else if (data.fallback) {
        window.open(data.fallback, '_blank');
        setPurchaseNotes(prev => ({ ...prev, [key]: 'No results on Apollo — opened Google fallback' }));
      } else {
        const apolloFallback = `https://www.google.com/search?q=site:apollopharmacy.in+${encodeURIComponent(query)}`;
        window.open(apolloFallback, '_blank');
        setPurchaseNotes(prev => ({ ...prev, [key]: 'No results — opened Google fallback' }));
      }
    } catch (err) {
      console.error('Purchase check failed', err);
      const fallback = `https://www.google.com/search?q=site:apollopharmacy.in+${encodeURIComponent(query)}`;
      window.open(fallback, '_blank');
      setPurchaseNotes(prev => ({ ...prev, [key]: 'Error checking Apollo — opened Google fallback' }));
    }

    // clear message after 6s
    setTimeout(() => setPurchaseNotes(prev => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    }), 6000);
  };

  const addToCart = (med) => {
    setCart(prev => {
      const exists = prev.find(item => item.name === med.name);
      if (exists) {
        return prev.map(item =>
          item.name === med.name ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      // Assign a mock price if not present (between 50 and 500)
      const mockPrice = Math.floor(Math.random() * 450) + 50;
      return [...prev, { ...med, id: Date.now(), quantity: 1, price: mockPrice }];
    });
    alert(`${med.name} added to your health cart!`);
  };

  const updateQuantity = (id, delta) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const calculateTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };


  // Handle drag events
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  // Remove prescription
  const removePrescription = (id) => {
    setPrescriptions(prev => prev.filter(p => p.id !== id));
  };

  // Handle book appointment
  const handleBookAppointment = (doctorName) => {
    alert(`Booking appointment with ${doctorName}. This feature will be implemented soon!`);
  };

  return (
    <div className="app">
      <div className="hero-gradient"></div>
      <header className="app-header">
        <div className="app-logo">
          <img src="/aura-logo.png" alt="Aura Health Logo" className="logo-image" style={{ width: '80px', height: '80px', borderRadius: '15px' }} />
          <span className="logo-name">Aura Health</span>
        </div>
        <p>Your AI-Powered Pregnancy & Wellness Companion</p>
      </header>

      <main className="main-content">
        {/* Prescription Upload Section */}
        <section className="prescription-section">
          <h2 className="section-title">Upload Prescription</h2>
          <p className="section-subtitle">
            Upload an image of your doctor’s prescription to get AI-based analysis
          </p>


          <div
            className={`upload-container ${isDragging ? 'drag-over' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="upload-icon">📄</div>
            <h3>Drop your prescription here</h3>
            <p>or click to browse from your device</p>
            <button className="upload-button" onClick={(e) => e.stopPropagation()}>
              Choose Files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="file-input"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
            />
          </div>

          {/* Prescription Preview */}
          {prescriptions.length > 0 && (
            <div className="prescription-preview">
              {prescriptions.map((prescription) => {
                const analysis = analysisResults[prescription.id];

                return (
                  <div key={prescription.id} className="preview-item" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
                      <img
                        src={prescription.preview}
                        alt={prescription.name}
                        className="preview-image"
                      />
                      <div className="preview-info" style={{ flex: 1 }}>
                        <h4>{prescription.name}</h4>
                        <p>Size: {prescription.size} • Uploaded: {prescription.uploadDate}</p>

                        {prescription.analyzing && (
                          <div style={{ marginTop: 'var(--spacing-sm)', color: '#4facfe' }}>
                            <span>🔄 Analyzing prescription...</span>
                          </div>
                        )}

                        {prescription.analyzed && (
                          <div style={{ marginTop: 'var(--spacing-sm)', color: '#00f2fe' }}>
                            <span>✅ Analysis complete</span>
                          </div>
                        )}

                        {prescription.error && (
                          <div style={{ marginTop: 'var(--spacing-sm)', color: '#f5576c' }}>
                            <span>❌ Analysis failed. Make sure the backend is running.</span>
                          </div>
                        )}
                      </div>
                      <button
                        className="remove-button"
                        onClick={() => removePrescription(prescription.id)}
                      >
                        Remove
                      </button>
                    </div>

                    {/* Display analyzed data */}
                    {analysis && (
                      <div className="analysis-results">
                        <h4 style={{ marginBottom: 'var(--spacing-md)', color: 'var(--text-primary)' }}>📋 Prescription Details</h4>

                        {/* Patient Information */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
                          <div className="info-field">
                            <strong>Patient:</strong> {analysis.patient_name}
                          </div>
                          <div className="info-field">
                            <strong>Age:</strong> {analysis.patient_age}
                          </div>
                          <div className="info-field">
                            <strong>Gender:</strong> {analysis.patient_gender}
                          </div>
                          <div className="info-field">
                            <strong>Doctor:</strong> {analysis.doctor_name}
                          </div>
                          <div className="info-field">
                            <strong>License:</strong> {analysis.doctor_license}
                          </div>
                          <div className="info-field">
                            <strong>Date:</strong> {analysis.prescription_date}
                          </div>
                        </div>

                        {/* Medications Table */}
                        {analysis.medications && analysis.medications.length > 0 && (
                          <div style={{ marginBottom: 'var(--spacing-md)' }}>
                            <h5 style={{ marginBottom: 'var(--spacing-sm)', color: 'var(--text-primary)' }}> Medications</h5>
                            <div style={{ overflowX: 'auto' }}>
                              <table>
                                <thead>
                                  <tr>
                                    <th>Medication</th>
                                    <th>Dosage</th>
                                    <th>Frequency</th>
                                    <th>Duration</th>
                                    <th>Purchase</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {analysis.medications.map((med, index) => (
                                    <tr key={index}>
                                      <td>{med.name}</td>
                                      <td>{med.dosage}</td>
                                      <td>{med.frequency}</td>
                                      <td>{med.duration}</td>
                                      <td>
                                        {buildApolloSearchUrl(med) ? (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <button
                                              type="button"
                                              onClick={(e) => handlePurchaseClick(prescription.id, med, index, e)}
                                              title={buildApolloSearchUrl(med)}
                                              aria-label={`Search ${med.name} on Apollo Pharmacy`}
                                              style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                backgroundColor: 'var(--secondary-color)',
                                                color: 'white',
                                                padding: '6px 12px',
                                                borderRadius: '100px',
                                                textDecoration: 'none',
                                                fontSize: '0.85rem',
                                                fontWeight: '500',
                                                transition: 'transform 0.2s',
                                                border: 'none',
                                                cursor: 'pointer'
                                              }}
                                              onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                              onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                            >
                                              <img
                                                src="https://images.apollo247.in/images/apollopharmacy/pharmacy_header.svg?tr=q-85,w-24,dpr-1,c-at_max"
                                                alt="Apollo"
                                                style={{ width: '18px', height: '18px', display: 'inline-block', marginRight: '6px' }}
                                              />
                                              Purchase
                                            </button>

                                            <button
                                              type="button"
                                              onClick={() => addToCart(med)}
                                              style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: '6px',
                                                backgroundColor: 'var(--primary-color)',
                                                color: 'white',
                                                padding: '6px 12px',
                                                borderRadius: '100px',
                                                border: 'none',
                                                fontSize: '0.85rem',
                                                fontWeight: '500',
                                                cursor: 'pointer'
                                              }}
                                            >
                                              Add to Cart
                                            </button>

                                            {purchaseNotes[`${prescription.id}-${index}`] && (
                                              <span style={{ fontSize: '0.85rem', color: '#666' }}>{purchaseNotes[`${prescription.id}-${index}`]}</span>
                                            )}
                                          </div>
                                        ) : (
                                          <span style={{ color: '#666', fontSize: '0.9rem' }}>N/A</span>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Detailed Usage & Safety Table */}
                        {analysis.medications && analysis.medications.some(m => m.purpose || m.usage_instruction) && (
                          <div style={{ marginBottom: 'var(--spacing-md)' }}>
                            <h5 style={{ marginBottom: 'var(--spacing-sm)', color: 'var(--text-primary)' }}> Usage & Safety Guide</h5>
                            <div style={{ overflowX: 'auto' }}>
                              <table>
                                <thead>
                                  <tr>
                                    <th>Medicine</th>
                                    <th>Purpose</th>
                                    <th>Usage Instruction</th>
                                    <th>Safety Warning</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {analysis.medications.map((med, index) => (
                                    <tr key={index}>
                                      <td style={{ fontWeight: '500' }}>{med.name}</td>
                                      <td>{med.purpose || '—'}</td>
                                      <td>{med.usage_instruction || '—'}</td>
                                      <td>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                          {med.safety_warning && !med.safety_warning.toLowerCase().includes('safe') ? (
                                            <span style={{ color: '#c53030', fontWeight: '600' }}>⚠️ {med.safety_warning}</span>
                                          ) : (
                                            <span style={{ color: '#2f855a' }}>✅ {med.safety_warning || 'Generally Safe'}</span>
                                          )}

                                          {med.dosage_suggestion && med.dosage_suggestion !== 'Dosage appropriate' && (
                                            <div style={{
                                              fontSize: '0.8rem',
                                              marginTop: '4px',
                                              padding: '6px',
                                              backgroundColor: '#fffaf0',
                                              borderLeft: '3px solid #ed8936',
                                              color: '#7b341e',
                                              borderRadius: '4px'
                                            }}>
                                              <strong>Dosage Note:</strong> {med.dosage_suggestion}
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* Additional Notes */}
                        {analysis.additional_notes && analysis.additional_notes !== 'Not available' && (
                          <div>
                            <h5 style={{ marginBottom: 'var(--spacing-sm)', color: 'var(--text-primary)' }}> Additional Notes</h5>
                            <p style={{
                              color: 'var(--text-secondary)',
                              lineHeight: '1.6',
                              whiteSpace: 'pre-wrap',
                              backgroundColor: 'rgba(0,0,0,0.02)',
                              padding: '12px',
                              borderRadius: '8px',
                              borderLeft: '4px solid #4facfe'
                            }}>{analysis.additional_notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Services Section */}
        <section className="services-section">
          <h2 className="section-title">Our Smart AI Services</h2>
          <div className="services-grid">
            {services.map(service => (
              <div key={service.id} className="service-card">
                <span className="service-icon">{service.icon}</span>
                <h3>{service.title}</h3>
                <p>{service.description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Cart UI */}
      <button className="cart-toggle" onClick={() => setIsCartOpen(true)}>
        🛒
        {cart.length > 0 && <span className="cart-count">{cart.length}</span>}
      </button>

      {isCartOpen && (
        <>
          <div className="cart-overlay" onClick={() => setIsCartOpen(false)}></div>
          <div className="cart-modal">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3>Your Health Cart</h3>
              <button onClick={() => setIsCartOpen(false)} style={{ border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
            </div>
            {cart.length === 0 ? (
              <p>Your cart is empty.</p>
            ) : (
              <div>
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {cart.map(item => (
                    <div key={item.id} className="cart-item">
                      <div className="cart-item-info">
                        <h4>{item.name}</h4>
                        <p>Rate: ₹{item.price}</p>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="quantity-controls">
                          <button onClick={() => updateQuantity(item.id, -1)}>−</button>
                          <span>{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.id, 1)}>+</button>
                        </div>
                        <div style={{ minWidth: '80px', textAlign: 'right', fontWeight: 'bold' }}>
                          ₹{item.price * item.quantity}
                        </div>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', padding: '5px' }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{
                  marginTop: '1.5rem',
                  paddingTop: '1rem',
                  borderTop: '2px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1.5rem'
                }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: '600' }}>Total Amount:</span>
                  <span style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--primary-color)' }}>₹{calculateTotal()}</span>
                </div>

                <div style={{ textAlign: 'center' }}>
                  <button className="upload-button" style={{ width: '100%', padding: '15px' }}>
                    Confirm & Purchase
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default App;

import './scoped.css';

import React, { useState } from 'react';

import { Helmet } from 'react-helmet-async';

import heroLogo27 from '../../img/about/frame1/image 27.png';
import heroLogo29 from '../../img/about/frame1/image 29.png';
import heroLogo30 from '../../img/about/frame1/image 30.png';
import heroLogo31 from '../../img/about/frame1/image 31.png';
import heroLogo32 from '../../img/about/frame1/image 32.png';
import heroLogo1 from '../../img/about/frame1/logo 1.png';
import teamLogo from '../../img/about/frame11/logo 1.png';
import ctaBackground from '../../img/about/frame15/image 23.png';
import aboutLogo from '../../img/about/image 26.png';

const AboutPage = () => {
    const [isYearly, setIsYearly] = useState(false);

    return (
        <>
            <Helmet>
                <title>About - Genomic Literature Knowledge Base</title>
                <meta name="description" content="Discover insights from 33M+ genomic research articles. GLKB enables AI-powered search across genes, diseases, variants, and chemicals with high accuracy." />
                <meta property="og:title" content="About - Genomic Literature Knowledge Base | AI-Powered Genomics Search" />
            </Helmet>
            <div className="about-page">
                <header className="about-nav">
                    <div className="about-nav-left">
                        <div className="about-logo">
                            <img src={aboutLogo} alt="GLKB logo" />
                        </div>
                    </div>
                    <div className="about-nav-actions">
                        <button className="about-nav-text" type="button">Pricing</button>
                        <button className="about-nav-cta" type="button">Get Started</button>
                    </div>
                </header>

                <section className="about-page-section about-hero" id="top">
                    <div className="about-frame about-hero-frame">
                        <div className="about-hero-left">
                            <h1>Weeks of research, done in minutes.</h1>
                            <p>
                                GLKB is an AI-powered research engine that synthesizes biomedical literature into structured,
                                evidence-backed answers grounded in real publications, not just predictions.
                            </p>
                            <div className="about-hero-actions">
                                <button className="about-primary" type="button">Try GLKB</button>
                                <button className="about-secondary" type="button">View Demo</button>
                            </div>
                        </div>
                        <div className="about-hero-right">
                            <div className="about-hero-collage">
                                <div className="about-placeholder about-placeholder--hero-main">Image placeholder</div>
                            </div>
                        </div>
                        <div className="about-hero-footer">
                            <div className="about-hero-trust">Trusted by the biomedical research community</div>
                            <div className="about-hero-logos">
                                <img className="about-hero-logo about-hero-logo--wide about-hero-logo--blend" src={heroLogo27} alt="Partner logo" />
                                <img className="about-hero-logo about-hero-logo--narrow" src={heroLogo1} alt="Partner logo" />
                                <img className="about-hero-logo about-hero-logo--wide" src={heroLogo32} alt="Partner logo" />
                                <img className="about-hero-logo about-hero-logo--wide" src={heroLogo29} alt="Partner logo" />
                                <img className="about-hero-logo about-hero-logo--medium about-hero-logo--blend" src={heroLogo30} alt="Partner logo" />
                                <img className="about-hero-logo about-hero-logo--narrow" src={heroLogo31} alt="Partner logo" />
                            </div>
                        </div>
                    </div>
                </section>

                <section className="about-page-section about-feature" id="features">
                    <div className="about-frame about-feature-frame">
                        <div className="about-feature-text">
                            <div className="about-feature-number">1</div>
                            <h2>Generate Answers</h2>
                            <p>
                                GLKB searches across 38M+ research articles, reads the most relevant papers, and synthesizes clear answers
                                with traceable sources.
                            </p>
                        </div>
                        <div className="about-feature-media">
                            <div className="about-placeholder about-placeholder--feature">Image placeholder</div>
                        </div>
                    </div>
                </section>

                <section className="about-page-section about-feature about-feature--reverse">
                    <div className="about-frame about-feature-frame">
                        <div className="about-feature-text">
                            <div className="about-feature-number">2</div>
                            <h2>Verify Sources</h2>
                            <p>
                                Follow citations to see the original research behind every statement. Every claim links directly to its source paper.
                            </p>
                        </div>
                        <div className="about-feature-media">
                            <div className="about-placeholder about-placeholder--feature">Image placeholder</div>
                        </div>
                    </div>
                </section>

                <section className="about-page-section about-feature">
                    <div className="about-frame about-feature-frame">
                        <div className="about-feature-text">
                            <div className="about-feature-number">3</div>
                            <h2>Show Original Sentences</h2>
                            <p>
                                View the exact sentences from research papers that directly support each point in the AI-generated answer.
                            </p>
                        </div>
                        <div className="about-feature-media">
                            <div className="about-placeholder about-placeholder--feature">Image placeholder</div>
                        </div>
                    </div>
                </section>

                <section className="about-page-section about-feature about-feature--reverse">
                    <div className="about-frame about-feature-frame">
                        <div className="about-feature-text">
                            <div className="about-feature-number">4</div>
                            <h2>Save and Organize</h2>
                            <p>
                                Bookmark useful papers and conversations to manage your research more easily. Build your personal research library.
                            </p>
                        </div>
                        <div className="about-feature-media">
                            <div className="about-placeholder about-placeholder--feature">Image placeholder</div>
                        </div>
                    </div>
                </section>

                <section className="about-page-section about-feature">
                    <div className="about-frame about-feature-frame">
                        <div className="about-feature-text">
                            <div className="about-feature-number">5</div>
                            <h2>Explore biomedical relationships visually</h2>
                            <p>
                                Visually explore connections between genes, diseases, drugs, and pathways, and jump directly to the supporting research.
                            </p>
                        </div>
                        <div className="about-feature-media">
                            <div className="about-placeholder about-placeholder--feature">Image placeholder</div>
                        </div>
                    </div>
                </section>

                <section className="about-page-section about-why" id="why">
                    <div className="about-frame about-why-frame">
                        <h2>Why GLKB</h2>
                        <div className="about-why-content">
                            <div className="about-why-text">
                                <div>
                                    <h3>The Problem</h3>
                                    <ul className="about-why-list">
                                        <li>Overwhelming volume of literature</li>
                                        <li>Keyword-based search lacks synthesis</li>
                                        <li>Time-consuming manual review</li>
                                    </ul>
                                </div>
                                <div>
                                    <h3>Our Approach</h3>
                                    <ul className="about-why-list">
                                        <li>AI-driven synthesis across multiple studies</li>
                                        <li>Evidence-first reasoning with traceable citations</li>
                                        <li>Structured knowledge grounded in biomedical ontologies</li>
                                    </ul>
                                </div>
                            </div>
                            <div className="about-placeholder about-placeholder--why">Image placeholder</div>
                        </div>
                    </div>
                </section>

                <section className="about-page-section about-work" id="workflow">
                    <div className="about-frame about-work-frame">
                        <h2>How GLKB Works</h2>
                        <div className="about-card-grid">
                            <div className="about-card">
                                <h3>1</h3>
                                <h4>Ask a Question</h4>
                                <p>Input a biomedical query in natural language.</p>
                            </div>
                            <div className="about-card">
                                <h3>2</h3>
                                <h4>Retrieve & Rank Evidence</h4>
                                <p>GLKB identifies the most relevant literature across large-scale datasets.</p>
                            </div>
                            <div className="about-card">
                                <h3>3</h3>
                                <h4>Synthesize Insights</h4>
                                <p>AI models aggregate findings into a structured, concise answer.</p>
                            </div>
                            <div className="about-card">
                                <h3>4</h3>
                                <h4>Verify & Explore</h4>
                                <p>Users can trace every claim back to source papers and explore relationships via knowledge graph.</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="about-page-section about-use" id="use-cases">
                    <div className="about-frame about-use-frame">
                        <h2>Use Cases</h2>
                        <div className="about-card-grid">
                            <div className="about-card">
                                <h4>Academic Research</h4>
                                <p>Accelerate literature review and hypothesis formation.</p>
                            </div>
                            <div className="about-card">
                                <h4>Clinical Insights</h4>
                                <p>Quickly understand evidence across studies for disease and treatment questions.</p>
                            </div>
                            <div className="about-card">
                                <h4>Gene Discovery</h4>
                                <p>Explore gene–drug–pathway relationships at scale.</p>
                            </div>
                            <div className="about-card">
                                <h4>Education</h4>
                                <p>Support learning with structured, explainable biomedical knowledge.</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="about-page-section about-accuracy">
                    <div className="about-frame about-accuracy-frame">
                        <h2>GLKB significantly improves LLM accuracy</h2>
                        <div className="about-accuracy-grid">
                            <div className="about-accuracy-left">
                                <div className="about-accuracy-value">+ 24.8%</div>
                                <div className="about-accuracy-label">Average Accuracy Improvement</div>
                                <div className="about-accuracy-caption">Evaluated on PubMedQA-HC (1,500 curated queries)</div>
                            </div>
                            <div className="about-accuracy-right">
                                <div className="about-placeholder about-placeholder--table">Table placeholder</div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="about-page-section about-team" id="team">
                    <div className="about-frame about-team-frame">
                        <h2>The Team</h2>
                        <p>
                            GLKB is built by a multidisciplinary team at the intersection of AI, biomedical research, and knowledge systems from
                            University of Michigan, Ann Arbor.
                        </p>
                        <img className="about-team-logo" src={teamLogo} alt="Team logo" />
                    </div>
                </section>

                <section className="about-page-section about-pricing" id="pricing">
                    <div className="about-frame about-pricing-frame">
                        <h2>Pricing</h2>
                        <div className="about-pricing-switch">
                            <button
                                className={`about-pricing-switch-toggle ${isYearly ? 'is-yearly' : 'is-monthly'}`}
                                type="button"
                                role="switch"
                                aria-checked={isYearly}
                                aria-label="Billing frequency"
                                onClick={() => setIsYearly((prev) => !prev)}
                            >
                                <span className="about-pricing-switch-thumb" />
                                <span className={`about-pricing-switch-text ${!isYearly ? 'about-pricing-switch-text--active' : ''}`}>Pay monthly</span>
                                <span className={`about-pricing-switch-text ${isYearly ? 'about-pricing-switch-text--active' : ''}`}>Pay yearly</span>
                            </button>
                        </div>
                        <div className="about-pricing-grid">
                            <div className="about-card">
                                <h4>Free</h4>
                                <p>Limited queries & exploration</p>
                            </div>
                            <div className="about-card">
                                <h4>Plus</h4>
                                <p>Education verification required</p>
                            </div>
                            <div className="about-card">
                                <h4>Pro</h4>
                                <p>Subscription</p>
                            </div>
                            <div className="about-card">
                                <h4>Enterprise</h4>
                                <p>Subscription</p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="about-page-section about-faq" id="faq">
                    <div className="about-frame about-faq-frame">
                        <h2>FAQ</h2>
                        <div className="about-faq-list">
                            <div className="about-faq-item"><span>Is GLKB replacing PubMed?</span><span>+</span></div>
                            <div className="about-faq-item"><span>How reliable are the answers?</span><span>+</span></div>
                            <div className="about-faq-item"><span>How is GLKB different from PubMed or Google Scholar?</span><span>+</span></div>
                            <div className="about-faq-item"><span>What kind of questions can I ask?</span><span>+</span></div>
                            <div className="about-faq-item"><span>Where does GLKB get its data?</span><span>+</span></div>
                            <div className="about-faq-item"><span>Is GLKB intended for clinical decision-making?</span><span>+</span></div>
                            <div className="about-faq-item"><span>Can I use GLKB for academic publications?</span><span>+</span></div>
                        </div>
                    </div>
                </section>

                <section className="about-page-section about-cta" id="cta">
                    <div className="about-frame about-cta-frame">
                        <img className="about-cta-bg" src={ctaBackground} alt="" aria-hidden="true" />
                        <h2>Get Started with GLKB Today</h2>
                        <div className="about-hero-actions">
                            <button className="about-primary" type="button">Try GLKB</button>
                            <button className="about-secondary" type="button">View Demo</button>
                        </div>
                        <div className="about-footer">
                            <img className="about-footer-logo" src={aboutLogo} alt="GLKB logo" />
                            <div className="about-footer-content">
                                <div className="about-footer-links">
                                    <span>Terms of Use</span>
                                    <span>Privacy Policy</span>
                                    <span>Refund & Cancellation</span>
                                    <span>2026 Liu Lab</span>
                                </div>
                                <div className="about-footer-contact">Contact Us</div>
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </>
    );
};

export default AboutPage;
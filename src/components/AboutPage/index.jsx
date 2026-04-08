import './scoped.css';

import React, {
  useEffect,
  useState,
} from 'react';

import { Helmet } from 'react-helmet-async';
import {
  useLocation,
  useNavigate,
} from 'react-router-dom';

import DoneIcon from '@mui/icons-material/Done';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

import featureImage1
  from '../../img/about/features/GLKB About_Feature 1_illus.png';
import featureImage2
  from '../../img/about/features/GLKB About_Feature 2_illus.png';
import featureImage3
  from '../../img/about/features/GLKB About_Feature 3_illus.png';
import featureImage4
  from '../../img/about/features/GLKB About_Feature 4_illus.png';
import featureImage5
  from '../../img/about/features/GLKB About_Feature 5_illus.png';
import heroLogo27 from '../../img/about/frame1/image 27.png';
import heroLogo29 from '../../img/about/frame1/image 29.png';
import heroLogo30 from '../../img/about/frame1/image 30.png';
import heroLogo31 from '../../img/about/frame1/image 31.png';
import heroLogo32 from '../../img/about/frame1/image 32.png';
import heroLogo1 from '../../img/about/frame1/logo 1.png';
import teamLogo from '../../img/about/frame11/logo 1.png';
import enterpriseIcon
  from '../../img/about/frame13/tdesign_institution-checked.svg';
import ctaBackground from '../../img/about/frame15/image 23.png';
import homeImage from '../../img/about/home.png';
import aboutLogo from '../../img/about/image 26.png';
import accuracyTable from '../../img/about/table.png';
import usecaseIconBook from '../../img/about/usecase/book_5.svg';
import usecaseBottleneck from '../../img/about/usecase/bottleneck.svg';
import usecaseCross from '../../img/about/usecase/cross.svg';
import usecaseIconZap from '../../img/about/usecase/fi_zap.svg';
import usecaseGaps from '../../img/about/usecase/gaps.svg';
import usecaseIconGene from '../../img/about/usecase/genetics.svg';
import usecaseIconMenu from '../../img/about/usecase/menu_book.svg';
import usecaseNavigate from '../../img/about/usecase/navigate.svg';
import usecaseIconPsych from '../../img/about/usecase/psychology.svg';
import usecaseValidate from '../../img/about/usecase/validate.svg';
import workflowAsk
  from '../../img/about/workflow/step1_ask_question_transparent.svg';
import workflowRetrieve
  from '../../img/about/workflow/step2_retrieve_rank_transparent.svg';
import workflowSynthesize
  from '../../img/about/workflow/step3_synthesize_transparent.svg';
import workflowVerify
  from '../../img/about/workflow/step4_verify_explore_transparent.svg';
import faqData from './faqData.json';

const AboutPage = () => {
    const [isYearly, setIsYearly] = useState(true);
        const [expandedFaqId, setExpandedFaqId] = useState(null);
    const location = useLocation();
    const navigate = useNavigate();

    const handleGoToLogin = () => {
        navigate('/login');
    };

    const handleGoToPricing = () => {
        const section = document.getElementById('pricing');
        if (section) {
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            return;
        }
        navigate('/about#pricing');
    };

    useEffect(() => {
        if (!location.hash) return;
        const targetId = location.hash.replace('#', '').trim();
        if (!targetId) return;

        // Delay until layout settles so scrolling lands on the right section.
        const timer = window.setTimeout(() => {
            const section = document.getElementById(targetId);
            if (section) {
                section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 0);

        return () => {
            window.clearTimeout(timer);
        };
    }, [location.hash]);

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
                        <button
                            className="about-nav-text"
                            type="button"
                            onClick={handleGoToPricing}
                        >
                            Pricing
                        </button>
                        <button className="about-nav-cta" type="button" onClick={handleGoToLogin}>Get Started</button>
                    </div>
                </header>

                <section className="about-page-section about-hero" id="top">
                    <div className="about-frame about-hero-frame">
                        <div className="about-hero-left">
                            <h1>Weeks of research,<br />done in minutes.</h1>
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
                                <img className="about-hero-image" src={homeImage} alt="GLKB home" />
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
                            <img className="about-placeholder--feature" src={featureImage1} alt="Generate answers" />
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
                            <img className="about-placeholder--feature" src={featureImage2} alt="Verify sources" />
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
                            <img className="about-placeholder--feature" src={featureImage3} alt="Show original sentences" />
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
                            <img className="about-placeholder--feature" src={featureImage4} alt="Save and organize" />
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
                            <img className="about-placeholder--feature" src={featureImage5} alt="Explore biomedical relationships" />
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
                            <img className="about-why-image" src={homeImage} alt="Why GLKB" />
                        </div>
                    </div>
                </section>

                <section className="about-page-section about-work" id="workflow">
                    <div className="about-frame about-work-frame">
                        <h2 className="about-work-title">How GLKB Works</h2>
                        <div className="about-work-steps">
                            <div className="about-work-card">
                                <div className="about-work-card-header">
                                    <div className="about-work-step">1</div>
                                    <div className="about-work-name">Ask</div>
                                </div>
                                <img className="about-work-image" src={workflowAsk} alt="Ask" />
                                <p className="about-work-description">Input a biomedical query in natural language.</p>
                            </div>
                            <div className="about-work-card">
                                <div className="about-work-card-header">
                                    <div className="about-work-step">2</div>
                                    <div className="about-work-name">Retrieve</div>
                                </div>
                                <img className="about-work-image" src={workflowRetrieve} alt="Retrieve" />
                                <p className="about-work-description">
                                    GLKB identifies the most relevant literature across large-scale datasets.
                                </p>
                            </div>
                            <div className="about-work-card">
                                <div className="about-work-card-header">
                                    <div className="about-work-step">3</div>
                                    <div className="about-work-name">Synthesize</div>
                                </div>
                                <img className="about-work-image" src={workflowSynthesize} alt="Synthesize" />
                                <p className="about-work-description">
                                    AI models aggregate findings into a structured, concise answer.
                                </p>
                            </div>
                            <div className="about-work-card">
                                <div className="about-work-card-header">
                                    <div className="about-work-step">4</div>
                                    <div className="about-work-name">Verify & Cite</div>
                                </div>
                                <img className="about-work-image" src={workflowVerify} alt="Verify and cite" />
                                <p className="about-work-description">
                                    Users can trace every claim back to source papers and explore relationships via knowledge graph.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="about-page-section about-use" id="use-cases">
                    <div className="about-frame about-use-frame">
                        <h2 className="about-use-title">Use Cases</h2>
                        <div className="about-use-wrap">
                            <div className="about-use-grid">
                                <div className="about-use-card about-use-card--wide about-use-card--validate">
                                    <img className="about-use-image about-use-image--validate" src={usecaseValidate} alt="Validate hypothesis" />
                                    <div className="about-use-content">
                                        <img className="about-use-icon" src={usecaseIconBook} alt="" aria-hidden="true" />
                                        <h3>Validate Your<br />Hypothesis Instantly</h3>
                                        <p>Assess whether your idea is novel and invest your effort where it counts.</p>
                                    </div>
                                </div>
                                <div className="about-use-card about-use-card--wide about-use-card--navigate">
                                    <img className="about-use-image about-use-image--navigate" src={usecaseNavigate} alt="Navigate complex biomedical landscapes" />
                                    <div className="about-use-content">
                                        <img className="about-use-icon" src={usecaseIconPsych} alt="" aria-hidden="true" />
                                        <h3>Navigate Complex<br />Biomedical Landscapes</h3>
                                        <p>Rigorously scope niche research areas, surfacing evidence across studies.</p>
                                    </div>
                                </div>
                                <div className="about-use-card about-use-card--tall about-use-card--cross">
                                    <img className="about-use-image about-use-image--cross" src={usecaseCross} alt="Connect the dots across disciplines" />
                                    <div className="about-use-content">
                                        <img className="about-use-icon" src={usecaseIconGene} alt="" aria-hidden="true" />
                                        <h3>Connect the Dots<br />Across Disciplines</h3>
                                        <p>Uncover hidden links between pathways, treatments, and fields.</p>
                                    </div>
                                </div>
                                <div className="about-use-card about-use-card--wide about-use-card--gaps">
                                    <img className="about-use-image about-use-image--gaps" src={usecaseGaps} alt="Spot gaps in the literature" />
                                    <div className="about-use-content">
                                        <img className="about-use-icon" src={usecaseIconMenu} alt="" aria-hidden="true" />
                                        <h3>Spot Gaps<br />in the Literature</h3>
                                        <p>Pinpoint unanswered questions, understudied genes, and emerging trends.</p>
                                    </div>
                                </div>
                                <div className="about-use-card about-use-card--wide about-use-card--bottleneck">
                                    <img className="about-use-image about-use-image--bottleneck" src={usecaseBottleneck} alt="Break through research bottlenecks" />
                                    <div className="about-use-content">
                                        <img className="about-use-icon" src={usecaseIconZap} alt="" aria-hidden="true" />
                                        <h3>Break through<br />Research Bottlenecks</h3>
                                        <p>Rapidly turn hours of literature review into structured, explainable insights.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="about-page-section about-accuracy">
                    <div className="about-frame about-accuracy-frame">
                        <h2>GLKB significantly improves LLM accuracy</h2>
                        <div className="about-accuracy-grid">
                            <div className="about-accuracy-left">
                                <div className="about-accuracy-label">Average Accuracy Improvement</div>
                                <div className="about-accuracy-value">+ 24.8%</div>
                                <div className="about-accuracy-caption">
                                    Evaluated on PubMedQA-HC<br />
                                    (1,500 curated queries)
                                </div>
                            </div>
                            <div className="about-accuracy-right">
                                <img className="about-accuracy-image" src={accuracyTable} alt="Accuracy Table" />
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
                        <h2 className="about-pricing-title">Select Your Plan</h2>
                        <p className="about-pricing-subtitle">Upgrade for a broader search experience and premium AI models.</p>
                        <div className="about-pricing-toggle-row">
                            <button
                                className={`about-pricing-toggle ${isYearly ? 'is-yearly' : 'is-monthly'}`}
                                type="button"
                                role="switch"
                                aria-checked={isYearly}
                                aria-label="Billing frequency"
                                onClick={() => setIsYearly((prev) => !prev)}
                            >
                                <span className="about-pricing-toggle-pill" />
                                <span className={`about-pricing-toggle-label ${isYearly ? 'is-active' : ''}`}>Pay yearly</span>
                                <span className={`about-pricing-toggle-label ${!isYearly ? 'is-active' : ''}`}>Pay monthly</span>
                            </button>
                            <span className="about-pricing-toggle-note">Save up to 20% with yearly!</span>
                        </div>
                        <div className="about-pricing-cards">
                            <article className="about-pricing-card">
                                <div className="about-pricing-card-header">
                                    <h3>Free</h3>
                                    <p>Get started with literature intelligence</p>
                                </div>
                                <div className="about-pricing-price">
                                    <span className="about-pricing-price-value">$0</span>
                                    <span className="about-pricing-price-suffix">
                                        <span className="about-pricing-price-slash">
                                            {isYearly ? '/ month, billed annually' : '/ month'}
                                        </span>
                                    </span>
                                </div>
                                <button className="about-pricing-button" type="button" onClick={handleGoToLogin}>
                                    Sign up
                                </button>
                                <div className="about-pricing-list">
                                    <div className="about-pricing-list-title">
                                        <TrendingUpIcon className="about-pricing-icon-trending" />
                                        Onboarding with our Free plan:
                                    </div>
                                    <ul>
                                        <li><DoneIcon className="about-pricing-icon-done" />Limited searches (10 per month)</li>
                                        <li><DoneIcon className="about-pricing-icon-done" />Limited search history access</li>
                                        <li><DoneIcon className="about-pricing-icon-done" />Limited memory and context</li>
                                    </ul>
                                </div>
                            </article>
                            <article className="about-pricing-card about-pricing-card--featured about-pricing-card--selected">
                                <span className="about-pricing-badge">Most Popular</span>
                                <div className="about-pricing-card-header">
                                    <h3>Plus</h3>
                                    <p>Search, organize, and analyze literature with AI</p>
                                </div>
                                <div className="about-pricing-price">
                                    <span className="about-pricing-price-value">${isYearly ? '15' : '18.7'}</span>
                                    <span className="about-pricing-price-suffix">
                                        <span className="about-pricing-price-slash">
                                            {isYearly ? '/ month, billed annually' : '/ month'}
                                        </span>
                                    </span>
                                </div>
                                <button className="about-pricing-button about-pricing-button--primary" type="button" onClick={handleGoToLogin}>
                                    Try for Free
                                </button>
                                <div className="about-pricing-list">
                                    <div className="about-pricing-list-title">
                                        <TrendingUpIcon className="about-pricing-icon-trending" />
                                        Everything in Free and:
                                    </div>
                                    <ul>
                                        <li><DoneIcon className="about-pricing-icon-done" />Up to 150 queries per month</li>
                                        <li><DoneIcon className="about-pricing-icon-done" />Full access to search history</li>
                                        <li><DoneIcon className="about-pricing-icon-done" />Full access to library</li>
                                        <li><DoneIcon className="about-pricing-icon-done" />Full access to export results and references</li>
                                        <li><DoneIcon className="about-pricing-icon-done" />Follow-up questions and multi-turn AI chat</li>
                                    </ul>
                                </div>
                            </article>
                            <article className="about-pricing-card">
                                <div className="about-pricing-card-header">
                                    <h3>Pro</h3>
                                    <p>Maximize your research productivity</p>
                                </div>
                                <div className="about-pricing-price">
                                    <span className="about-pricing-price-value">${isYearly ? '45' : '56.2'}</span>
                                    <span className="about-pricing-price-suffix">
                                        <span className="about-pricing-price-slash">
                                            {isYearly ? '/ month, billed annually' : '/ month'}
                                        </span>
                                    </span>
                                </div>
                                <button className="about-pricing-button" type="button">
                                    Choose Pro
                                </button>
                                <div className="about-pricing-list">
                                    <div className="about-pricing-list-title">
                                        <TrendingUpIcon className="about-pricing-icon-trending" />
                                        Everything in Plus and:
                                    </div>
                                    <ul>
                                        <li><DoneIcon className="about-pricing-icon-done" />Unlimited queries per month</li>
                                        <li><DoneIcon className="about-pricing-icon-done" />Bulk export</li>
                                        <li><DoneIcon className="about-pricing-icon-done" />Priority customer support</li>
                                        <li><DoneIcon className="about-pricing-icon-done" />Priority performance</li>
                                    </ul>
                                </div>
                            </article>
                            <article className="about-pricing-card">
                                <div className="about-pricing-card-header">
                                    <h3>Enterprise</h3>
                                    <p>Built for institutions and research teams</p>
                                </div>
                                <img className="about-pricing-icon" src={enterpriseIcon} alt="" aria-hidden="true" />
                                <button className="about-pricing-button" type="button">
                                    Contact Us
                                </button>
                                <div className="about-pricing-list">
                                    <div className="about-pricing-list-title">
                                        <TrendingUpIcon className="about-pricing-icon-trending" />
                                        Everything in Pro and:
                                    </div>
                                    <ul>
                                        <li><DoneIcon className="about-pricing-icon-done" />Team and user management</li>
                                        <li><DoneIcon className="about-pricing-icon-done" />API access and bulk queries</li>
                                        <li><DoneIcon className="about-pricing-icon-done" />Increased compute and query limits</li>
                                        <li><DoneIcon className="about-pricing-icon-done" />Dedicated support and onboarding</li>
                                        <li><DoneIcon className="about-pricing-icon-done" />Custom pricing</li>
                                    </ul>
                                </div>
                            </article>
                        </div>
                    </div>
                </section>

                <section className="about-page-section about-faq" id="faq">
                    <div className="about-frame about-faq-frame">
                        <h2>FAQ</h2>
                        <div className="about-faq-list">
                            {faqData.map((item) => {
                                const isExpanded = expandedFaqId === item.id;
                                return (
                                    <div key={item.id} className={`about-faq-item${isExpanded ? ' is-expanded' : ''}`}>
                                        <button
                                            type="button"
                                            className="about-faq-question"
                                            onClick={() => setExpandedFaqId(isExpanded ? null : item.id)}
                                            aria-expanded={isExpanded}
                                            aria-controls={`faq-answer-${item.id}`}
                                        >
                                            <span>{item.question}</span>
                                            <span className="about-faq-toggle" aria-hidden="true">+</span>
                                        </button>
                                        <div
                                            id={`faq-answer-${item.id}`}
                                            className="about-faq-answer-wrap"
                                            aria-hidden={!isExpanded}
                                        >
                                            <div className="about-faq-answer">{item.answer}</div>
                                        </div>
                                    </div>
                                );
                            })}
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
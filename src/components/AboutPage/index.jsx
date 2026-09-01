/**
 * About, from Figma 604:7226.
 *
 * This page is also where the blog lives: "From the Lab" lists the articles,
 * and /blog sends readers here. See SiteChrome for the nav and footer both
 * ends of the site share.
 */
import './scoped.css';

import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import { Helmet } from 'react-helmet-async';
import {
  useLocation,
  useNavigate,
} from 'react-router-dom';

import AddIcon from '@mui/icons-material/Add';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import RemoveIcon from '@mui/icons-material/Remove';

import teamLogo from '../../img/about/frame11/logo 1.png';
import logoHarvard from '../../img/about/v2/trusted/harvard.png';
import logoMichigan from '../../img/about/v2/trusted/michigan-medicine.png';
import logoMit from '../../img/about/v2/trusted/mit.png';
import logoUcSanDiego from '../../img/about/v2/trusted/uc-san-diego.png';
import logoVanderbilt from '../../img/about/v2/trusted/vanderbilt.png';
import logoWeillCornell from '../../img/about/v2/trusted/weill-cornell.png';
import evidenceImage from '../../img/about/v2/evidence-references.png';
import heroAppImage from '../../img/about/v2/hero-app.png';
import knowledgeGraphImage from '../../img/about/v2/knowledge-graph.png';
import browserMenu from '../../img/about/v2/browser/menu.svg';
import browserNewTab from '../../img/about/v2/browser/new-tab.svg';
import browserSecure from '../../img/about/v2/browser/secure.svg';
import browserTabShape from '../../img/about/v2/browser/tab.svg';
import browserTabClose from '../../img/about/v2/browser/tab-close.svg';
import browserActions from '../../img/about/v2/browser/toolbar-actions.svg';
import useCaseBookmark from '../../img/about/v2/use-cases/bookmark.svg';
import useCaseQuote from '../../img/about/v2/use-cases/quote.svg';
import browserFavicon from '../../img/GLKB_logo_icon.png';
import { useAuth } from '../Auth/AuthContext';
import { posts } from '../Blog/posts';
import { PostCard, SiteFooter, SiteNav } from '../SiteChrome';
import faqData from './faqData.json';
import { USE_CASES } from './useCases';

/* Figma 604:7257 — the six, in the design's order and at its widths. These are
   the frame's own exports: the repo's older logo files are cropped differently,
   so at a shared height they come out visibly smaller. */
const TRUSTED_LOGOS = [
    { src: logoWeillCornell, name: 'Weill Cornell Medicine', width: 177 },
    { src: logoMichigan, name: 'Michigan Medicine', width: 63 },
    { src: logoHarvard, name: 'Harvard University', width: 158 },
    { src: logoMit, name: 'Massachusetts Institute of Technology', width: 161 },
    { src: logoVanderbilt, name: 'Vanderbilt University', width: 184 },
    { src: logoUcSanDiego, name: 'UC San Diego', width: 205 },
];

/* Figma 604:7362 */
const STEPS = [
    ['Ask', 'Type any biomedical query: a gene, variant, drug target, or disease.'],
    ['Retrieve', 'GLKB searches 263M terms and 14.6M relationships, surfacing the most relevant PubMed papers.'],
    ['Reason', 'The AI synthesizes retrieved evidence into a structured, concise, cited answer.'],
    ['Verify', 'Every claim links to a PubMed ID. Gaps are labeled "none found" and never fabricated.'],
];

/* Figma 604:7399 — the three cards under the wide one. */
const DIFFERENTIATORS = [
    ['Biomedical-native', 'Built on the full PubMed corpus: 263M biomedical terms and 14.6M relationships across gene-disease associations, pathways, and ontology hierarchies.'],
    ['Reproducible by design', 'Same query, same results. Outputs are structured, machine-readable, and consistent across, making them suitable for publication-grade workflows.'],
    ['Built for scale', 'Analyze hundreds of targets, variants, or genes in parallel. Structured, cited outputs feed directly into your downstream pipeline.'],
];

/* Figma 604:7600 */
const STATS = [
    ['+24.8%', 'Accuracy improvement\non PubMedQA-HC'],
    ['263M', 'Biomedical terms in\nthe knowledge graph'],
    ['14.6M', 'Relationships\nencoded'],
    ['~30 min', 'To process 1,500 candidate\ngenes with full citations'],
];

const AboutPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [openFaqId, setOpenFaqId] = useState(faqData[0]?.id ?? null);
    const [useCase, setUseCase] = useState(USE_CASES[0].id);
    const { openLoginModal } = useAuth();
    const railRef = useRef(null);
    const [railOverflows, setRailOverflows] = useState(false);

    // The design draws the row mid-scroll, with the next card half off the edge
    // and an arrow over it. With few enough posts to fit there is nothing to
    // scroll to, so the arrow would be a button that does nothing.
    useEffect(() => {
        const rail = railRef.current;
        if (!rail) return undefined;
        const measure = () => setRailOverflows(rail.scrollWidth > rail.clientWidth + 1);
        measure();
        window.addEventListener('resize', measure);
        return () => window.removeEventListener('resize', measure);
    }, []);

    useEffect(() => {
        if (!location.hash) return undefined;
        const targetId = location.hash.replace('#', '').trim();
        if (!targetId) return undefined;

        // Wait for layout so the scroll lands on the right section.
        const timer = window.setTimeout(() => {
            document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 0);
        return () => window.clearTimeout(timer);
    }, [location.hash]);

    const activeUseCase = USE_CASES.find((item) => item.id === useCase) || USE_CASES[0];

    const scrollRail = () => {
        const rail = railRef.current;
        if (!rail) return;
        // One card plus its gap, so the row steps rather than glides an arbitrary
        // distance; wrap to the start once the end is in view.
        const step = (rail.firstElementChild?.getBoundingClientRect().width || 240) + 24;
        const atEnd = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 8;
        rail.scrollTo({ left: atEnd ? 0 : rail.scrollLeft + step, behavior: 'smooth' });
    };

    return (
        <>
            <Helmet>
                <title>About | GLKB</title>
                <meta name="description" content="GLKB synthesizes biomedical literature into structured, evidence-backed answers. Every claim links directly to its source paper." />
                <meta property="og:title" content="GLKB — AI-Powered Biomedical Research Engine" />
                <meta property="og:description" content="Weeks of research, done in minutes." />
            </Helmet>

            <div className="about-page">
                <SiteNav active="home" onGetStarted={openLoginModal} />

                <section className="about-hero" id="top">
                    <div className="about-hero-copy">
                        <p className="about-eyebrow">AI-Powered Biomedical Research Engine</p>
                        <h1 className="about-hero-title">
                            Weeks of research,
                            <br />
                            done in minutes.
                        </h1>
                        <p className="about-hero-lede">
                            GLKB synthesizes biomedical literature into structured, evidence-
                            <br />
                            backed answers. Every claim links directly to its source paper.
                        </p>
                        <div className="about-hero-actions">
                            <button type="button" className="site-button" onClick={() => navigate('/')}>
                                Try GLKB
                            </button>
                            <button type="button" className="site-button site-button--ghost" onClick={() => navigate('/')}>
                                View Demo
                            </button>
                        </div>
                    </div>
                    <div className="about-hero-media">
                        {/* Figma 1088:28340 — the Chrome frame, 79px of chrome over the
                            app, running off the right edge of the band. */}
                        <div className="about-browser">
                            <div className="about-browser-tabs">
                                <span className="about-browser-lights" aria-hidden="true">
                                    <i /><i /><i />
                                </span>
                                <span className="about-browser-tab">
                                    <img className="about-browser-tab-shape" src={browserTabShape} alt="" />
                                    <img className="about-browser-favicon" src={browserFavicon} alt="" />
                                    <span className="about-browser-tab-title">GLKB API Docs</span>
                                    <img className="about-browser-tab-close" src={browserTabClose} alt="" />
                                </span>
                                <img className="about-browser-newtab" src={browserNewTab} alt="" />
                            </div>
                            <div className="about-browser-toolbar">
                                <img className="about-browser-actions" src={browserActions} alt="" />
                                <span className="about-browser-address">
                                    <img className="about-browser-secure" src={browserSecure} alt="" />
                                    <span className="about-browser-url">https://glkb.org/</span>
                                </span>
                                <img className="about-browser-menu" src={browserMenu} alt="" />
                            </div>
                            <img className="about-browser-body" src={heroAppImage} alt="A GLKB answer with its citations" />
                        </div>
                    </div>
                </section>

                <section className="about-trusted">
                    <p className="about-trusted-title">Trusted by the biomedical researchers at:</p>
                    <div className="about-trusted-logos">
                        {TRUSTED_LOGOS.map((logo) => (
                            <img
                                key={logo.name}
                                className="about-trusted-logo"
                                style={{ width: `${logo.width}px` }}
                                src={logo.src}
                                alt={logo.name}
                            />
                        ))}
                    </div>
                </section>

                {/* The blog lives here: /blog sends readers to this section. */}
                <section className="about-section about-lab" id="from-the-lab">
                    <div className="about-inner">
                        <h2 className="about-lab-title">
                            From the Lab
                            <ChevronRightIcon className="about-lab-chevron" />
                        </h2>
                        <div className="about-lab-rail-wrap">
                            <div className="about-lab-rail" ref={railRef}>
                                {posts.map((post) => (
                                    <div className="about-lab-slot" key={post.slug}>
                                        <PostCard post={post} onOpen={(slug) => navigate(`/blog/${slug}`)} />
                                    </div>
                                ))}
                            </div>
                            {railOverflows && (
                                <button
                                    type="button"
                                    className="about-lab-next"
                                    onClick={scrollRail}
                                    aria-label="Show more posts"
                                >
                                    <ChevronRightIcon />
                                </button>
                            )}
                        </div>
                    </div>
                </section>

                <section className="about-section about-works" id="how-it-works">
                    <div className="about-inner">
                        <p className="about-eyebrow">From query to answer</p>
                        <h2 className="about-heading">How GLKB Works</h2>
                        <ol className="about-steps">
                            {STEPS.map(([name, body], index) => (
                                <li className="about-step" key={name}>
                                    <span className="about-step-number">{index + 1}</span>
                                    <h3 className="about-step-name">{name}</h3>
                                    <p className="about-step-body">{body}</p>
                                </li>
                            ))}
                        </ol>
                    </div>
                </section>

                <section className="about-section about-different" id="why">
                    <div className="about-inner">
                        <p className="about-eyebrow">By researcher, for researcher</p>
                        <h2 className="about-heading">What Makes GLKB Different</h2>
                        <article className="about-evidence">
                            <div className="about-evidence-text">
                                <h3 className="about-card-title">Evidence, not estimates</h3>
                                <p className="about-card-body">
                                    General LLMs can&apos;t tell you when they&apos;re guessing. GLKB grounds every
                                    answer in retrieved literature: your synthesis only reflects what the
                                    evidence actually says. Where support is missing, GLKB labels it &quot;none
                                    found&quot; rather than filling it in with plausible-sounding fabrications. That
                                    transparency is the feature.
                                </p>
                            </div>
                            <img className="about-evidence-media" src={evidenceImage} alt="A citation list with its source sentences" />
                        </article>
                        <div className="about-different-grid">
                            {DIFFERENTIATORS.map(([title, body]) => (
                                <article className="about-card" key={title}>
                                    <h3 className="about-card-title">{title}</h3>
                                    <p className="about-card-body">{body}</p>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="about-section about-graph" id="knowledge-graph">
                    <div className="about-inner about-graph-inner">
                        <div className="about-graph-copy">
                            <p className="about-eyebrow">The Knowledge Graph</p>
                            <h2 className="about-heading">
                                Visualize what
                                <br />
                                the literature knows and
                                <br />
                                where the gaps are.
                            </h2>
                            <p className="about-graph-body">
                                Explore connections between genes, diseases, drugs, and pathways, then jump
                                directly to the supporting papers. Not just what science has established, but
                                where the evidence runs thin.
                            </p>
                        </div>
                        <img className="about-graph-media" src={knowledgeGraphImage} alt="A knowledge graph linking genes, diseases, drugs and variants" />
                    </div>
                </section>

                <section className="about-section about-use" id="use-cases">
                    <div className="about-inner">
                        <p className="about-eyebrow">Use cases</p>
                        <h2 className="about-heading">Built for Your Research</h2>
                        <div className="about-tabs" role="tablist">
                            {USE_CASES.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    role="tab"
                                    aria-selected={item.id === activeUseCase.id}
                                    className={`about-tab${item.id === activeUseCase.id ? ' is-active' : ''}`}
                                    onClick={() => setUseCase(item.id)}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                        {activeUseCase.lede ? (
                            <p className="about-use-lede">{activeUseCase.lede}</p>
                        ) : null}
                        {/* The first tab is the worked example supplied by the design. */}
                        {activeUseCase.answer ? (
                        <div className="about-sample">
                            <div className="about-sample-question-bar">
                                <div className="about-sample-question">Q: {activeUseCase.question}</div>
                            </div>
                            <div className="about-sample-body">
                                <div className="about-sample-answer">
                                    <div className="about-sample-answer-content">
                                        {activeUseCase.answer.map((block, index) => {
                                            const key = `${block.type}-${block.text?.slice(0, 40) || index}`;
                                            if (block.type === 'heading') {
                                                return <p className="about-sample-answer-heading" key={key}>{block.text}</p>;
                                            }
                                            if (block.type === 'list') {
                                                return (
                                                    <ul className="about-sample-answer-list" key={key}>
                                                        {block.items.map((item) => <li key={item.slice(0, 48)}>{item}</li>)}
                                                    </ul>
                                                );
                                            }
                                            return <p key={key}>{block.text}</p>;
                                        })}
                                    </div>
                                </div>
                                <aside className="about-sample-references">
                                    <h3 className="about-sample-references-title">References</h3>
                                    {activeUseCase.references.map((reference, index) => (
                                        // eslint-disable-next-line react/no-array-index-key
                                        <div className="about-reference" key={`${reference.pmid}-${index}`}>
                                            <span className="about-reference-index">{index + 1}</span>
                                            <div className="about-reference-body">
                                                <p className="about-reference-title">{reference.title}</p>
                                                <p className="about-reference-meta">{reference.meta}</p>
                                                <div className="about-reference-quote">{reference.quote}</div>
                                                <div className="about-reference-footer">
                                                    <p className="about-reference-pmid">
                                                        {`PubMed ID: ${reference.pmid} · ${reference.citations} Citations`}
                                                    </p>
                                                    <span className="about-reference-actions" aria-hidden="true">
                                                        <img src={useCaseQuote} alt="" />
                                                        <img src={useCaseBookmark} alt="" />
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </aside>
                            </div>
                        </div>
                        ) : null}
                    </div>
                </section>

                <section className="about-stats">
                    {STATS.map(([value, label]) => (
                        <div className="about-stat" key={value}>
                            <div className="about-stat-value">{value}</div>
                            <div className="about-stat-label">{label}</div>
                        </div>
                    ))}
                </section>

                <section className="about-section about-team" id="team">
                    <div className="about-inner about-team-inner">
                        <img className="about-team-logo" src={teamLogo} alt="Michigan Medicine, University of Michigan" />
                        <div className="about-team-copy">
                            <p className="about-eyebrow">Behind GLKB</p>
                            <h2 className="about-heading">The Team</h2>
                            <p className="about-team-body">
                                GLKB is built by a multidisciplinary team at the intersection of AI, biomedical
                                research, and knowledge systems at the University of Michigan, Ann Arbor.
                            </p>
                        </div>
                    </div>
                </section>

                <section className="about-section about-faq" id="faq">
                    <div className="about-inner">
                        <h2 className="about-heading about-faq-heading">Frequently Asked Questions</h2>
                        <div className="about-faq-columns">
                            {faqData.map((item) => {
                                const isOpen = openFaqId === item.id;
                                return (
                                    <div className={`about-faq-item${isOpen ? ' is-open' : ''}`} key={item.id}>
                                        <button
                                            type="button"
                                            className="about-faq-question"
                                            aria-expanded={isOpen}
                                            aria-controls={`faq-${item.id}`}
                                            onClick={() => setOpenFaqId(isOpen ? null : item.id)}
                                        >
                                            <span>{item.question}</span>
                                            <span className="about-faq-toggle" aria-hidden="true">
                                                {isOpen ? <RemoveIcon /> : <AddIcon />}
                                            </span>
                                        </button>
                                        {isOpen && (
                                            <p className="about-faq-answer" id={`faq-${item.id}`}>{item.answer}</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                <SiteFooter />
            </div>
        </>
    );
};

export default AboutPage;

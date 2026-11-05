/**
 * About, first drawn from Figma 604:7226 and since turned into a scroll story:
 * the hero's screen tilts up into view, a statement lights word by word, the
 * knowledge base and the workflow each pin a screen while their content turns
 * over, and the rest of the page rises in as it is reached. motion.jsx holds
 * the machinery; without motion (prerender, reduced motion) every section is
 * simply there.
 *
 * This page is also where the blog lives: "From the Lab" lists the articles,
 * and /blog sends readers here. See SiteChrome for the nav and footer both
 * ends of the site share.
 */
import './scoped.css';

import React, {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';

import PublicPageSeo from '../Units/PublicPageSeo';
import {
    Link,
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
import browserFavicon from '../../img/GLKB_logo_icon.png';
import { CHAT_HOME_PATH, markAboutSeen } from '../../config/entryRoutes';
import { LITERATURE_REVIEW_ENABLED } from '../../config/features';
import { useAuth } from '../Auth/AuthContext';
import { posts } from '../Blog/posts';
import { SiteFooter, SiteNav } from '../SiteChrome';
import { DemoModal, DemoPlayer } from './DemoVideo';
import { EXAMPLE_QUESTIONS, exampleChatLink } from './exampleQuestions';
import faqData from './faqData.json';
import {
    CountUp,
    Track,
    easeInOut,
    segment,
    useMotionAllowed,
    useReveal,
    useScrollProgress,
} from './motion';
import LocalNav from './LocalNav';
import ReviewScene from './ReviewScene';
import ScaleScene from './ScaleScene';
import UseCasesSection from './UseCasesSection';
import WorkflowScene from './WorkflowScene';

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

/* The hero's backdrop: terms drifting at three depths, so they part at three
   speeds as the screen rises. Positions are percentages of the stage. */
const HERO_TERMS = [
    { label: 'TP53', type: 'gene', x: 7, y: 24, depth: 1 },
    { label: 'Insulin resistance', type: 'disease', x: 91, y: 20, depth: 1 },
    { label: 'Harmine', type: 'chemical', x: 6, y: 54, depth: 2 },
    { label: 'APOE ε4', type: 'variant', x: 93, y: 48, depth: 2 },
    { label: 'DYRK1A', type: 'gene', x: 8, y: 82, depth: 3 },
    { label: 'Type 2 diabetes', type: 'disease', x: 91, y: 78, depth: 3 },
];
const HERO_DOTS = [
    [18, 10, 1], [26, 36, 2], [3, 38, 1], [94, 30, 1], [76, 40, 2], [70, 8, 1],
    [97, 66, 2], [9, 70, 1], [30, 92, 2], [62, 94, 1], [88, 92, 1], [46, 6, 3],
];

/* Lit word by word as the reader scrolls through it. */
const STATEMENT = [
    ['Biomedical literature grows faster than anyone can read.', false],
    ['GLKB reads it for you, links what it finds, and shows you', false],
    ['exactly where every answer comes from.', true],
];
const STATEMENT_WORDS = STATEMENT.flatMap(([text, accent]) => text.split(' ').map((word) => [word, accent]));

/* Figma 604:7399 — the three cards under the wide one. */
const DIFFERENTIATORS = [
    ['Biomedical-native', 'Built on the full PubMed corpus: 41.2M+ papers, 3.71M+ biomedical terms and 14.6M+ relationships across gene-disease associations, pathways, and ontology hierarchies.'],
    ['Built for verification', 'Answers include literature references so you can review the supporting evidence and assess how it relates to your research question.'],
    ['Built for scale', 'Analyze hundreds of targets, variants, or genes in parallel. Structured, cited outputs feed directly into your downstream pipeline.'],
];

/* Questions of the kind researchers bring, in two rows that slide apart. */
/* The figures as a bento grid (Figma 604:7600's five, regrouped): the corpus, then what it buys. */
const NUMBERS = [
    { key: 'papers', value: '41.2M+', label: 'Papers indexed from the literature' },
    { key: 'terms', value: '3.71M+', label: 'Biomedical terms in the knowledge graph' },
    { key: 'relations', value: '14.6M+', label: 'Relationships encoded between them' },
    { key: 'accuracy', value: '+24.8%', label: 'Accuracy improvement on PubMedQA-HC' },
    { key: 'speed', value: '~30 min', label: 'To process 1,500 candidate genes with full citations' },
];
const TERM_TYPES = ['Genes', 'Diseases', 'Chemicals', 'Variants', 'Pathways'];

const REVIEW_PATH = '/literature-review';

const AboutPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [openFaqId, setOpenFaqId] = useState(faqData[0]?.id ?? null);
    const { isAuthenticated, loading: authLoading, openLoginModal } = useAuth();
    const previousAuth = useRef(null);
    // Where a sign-in started from this page goes next: the chat, unless the reader
    // asked for something that needed the account (a literature review).
    const afterSignIn = useRef(CHAT_HOME_PATH);
    const railRef = useRef(null);
    const [railOverflows, setRailOverflows] = useState(false);
    const pageRef = useRef(null);
    const heroRef = useRef(null);
    const statementRef = useRef(null);
    const motion = useMotionAllowed();
    const [demoOpen, setDemoOpen] = useState(false);
    const openDemo = useCallback(() => setDemoOpen(true), []);
    const closeDemo = useCallback(() => setDemoOpen(false), []);

    useReveal(pageRef, motion);

    // The hero's screen rises and flattens over the first part of the pin; the
    // eased value drives it so it settles rather than stops.
    useScrollProgress(heroRef, {
        mode: 'pin',
        onProgress: (progress) => {
            heroRef.current.style.setProperty('--e', easeInOut(segment(progress, 0, 0.8)).toFixed(4));
        },
    });
    useScrollProgress(statementRef, { mode: 'pin' });

    // The screen starts just under the copy, however tall the copy is at this width (it
    // wraps differently per window, and a news line can sit above the title).
    const heroCopyRef = useRef(null);
    useEffect(() => {
        const copy = heroCopyRef.current;
        const hero = heroRef.current;
        if (!copy || !hero) return undefined;
        const measure = () => hero.style.setProperty('--copy-h', `${copy.offsetHeight}px`);
        measure();
        if (typeof window.ResizeObserver !== 'function') {
            window.addEventListener('resize', measure);
            return () => window.removeEventListener('resize', measure);
        }
        const observer = new window.ResizeObserver(measure);
        observer.observe(copy);
        return () => observer.disconnect();
    }, []);

    // Redirect a sign-in completed on About, not a restored session or a signed-in
    // reader deliberately returning to About from inside the app.
    useEffect(() => {
        if (authLoading) return;
        if (previousAuth.current === false && isAuthenticated) {
            navigate(afterSignIn.current, { replace: true });
        }
        previousAuth.current = Boolean(isAuthenticated);
    }, [authLoading, isAuthenticated, navigate]);

    const handleGetStarted = () => {
        navigate(CHAT_HOME_PATH);
    };

    // A review needs an account (guests have AI Chat only), so a guest signs in first
    // and lands on the review's Scope step afterwards.
    const startReview = () => {
        if (isAuthenticated) {
            navigate(REVIEW_PATH);
            return;
        }
        afterSignIn.current = REVIEW_PATH;
        openLoginModal?.('Sign in to write a literature review. It’s free.');
    };

    // Once seen, `/` stops sending this browser here (config/entryRoutes.js).
    useEffect(() => {
        markAboutSeen();
    }, []);

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

    // One card plus its gap per press, so the row steps rather than glides.
    const scrollRail = (direction) => {
        const rail = railRef.current;
        if (!rail) return;
        const step = (rail.firstElementChild?.getBoundingClientRect().width || 320) + 24;
        rail.scrollBy({ left: direction * step, behavior: motion ? 'smooth' : 'auto' });
    };

    return (
        <>
            <PublicPageSeo title="GLKB: Genomic Literature Knowledge Base" description="GLKB synthesizes biomedical literature into structured, evidence-backed answers. Every claim links directly to its source paper." />

            <div className={`about-page${motion ? ' about-page--motion' : ''}`} ref={pageRef}>
                <SiteNav active="home" onGetStarted={handleGetStarted} />
                <LocalNav motion={motion} onTry={handleGetStarted} />

                <section className="about-hero" id="top" ref={heroRef}>
                    <div className="about-hero-stage">
                        <div className="about-hero-backdrop" aria-hidden="true">
                            {[1, 2, 3].map((depth) => (
                                <div className={`about-hero-layer about-hero-layer--${depth}`} key={depth}>
                                    {HERO_DOTS.filter(([, , d]) => d === depth).map(([x, y]) => (
                                        <i className="about-hero-dot" style={{ left: `${x}%`, top: `${y}%` }} key={`${x}-${y}`} />
                                    ))}
                                    {HERO_TERMS.filter((term) => term.depth === depth).map((term) => (
                                        <span
                                            className={`about-hero-term is-${term.type}`}
                                            style={{ left: `${term.x}%`, top: `${term.y}%` }}
                                            key={term.label}
                                        >
                                            {term.label}
                                        </span>
                                    ))}
                                </div>
                            ))}
                        </div>
                        <div className="about-hero-copy" ref={heroCopyRef}>
                            {/* The newest post, where a first-time reader will see it. */}
                            <Link className="about-hero-news" to={`/blog/${posts[0].slug}`}>
                                <span className="about-hero-news-tag">New</span>
                                <span className="about-hero-news-text">{posts[0].cardTitle || posts[0].title}</span>
                                <ChevronRightIcon className="about-hero-news-chevron" />
                            </Link>
                            <p className="about-eyebrow">AI-Powered Biomedical Research Engine</p>
                            <h1 className="about-hero-title">
                                Weeks of research,
                                <br />
                                done in minutes.
                            </h1>
                            <p className="about-hero-lede">
                                GLKB synthesizes biomedical literature into structured, evidence-backed
                                answers. Every claim links directly to its source paper.
                            </p>
                            <div className="about-hero-actions">
                                <button type="button" className="site-button" onClick={() => navigate(CHAT_HOME_PATH)}>
                                    Try GLKB
                                </button>
                                <button type="button" className="site-button site-button--ghost" onClick={openDemo}>
                                    View Demo
                                </button>
                            </div>
                        </div>
                        <div className="about-hero-media">
                            <div className="about-hero-glow" aria-hidden="true" />
                            {/* Figma 1088:28340 — the Chrome frame, 79px of chrome over the app. */}
                            <div className="about-browser">
                                <div className="about-browser-tabs">
                                    <span className="about-browser-lights" aria-hidden="true">
                                        <i /><i /><i />
                                    </span>
                                    <span className="about-browser-tab">
                                        <img className="about-browser-tab-shape" src={browserTabShape} alt="" />
                                        <img className="about-browser-favicon" src={browserFavicon} alt="" />
                                        <span className="about-browser-tab-title">GLKB</span>
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
                    </div>
                </section>

                <section className="about-trusted">
                    <p className="about-trusted-title">Trusted by the biomedical researchers at:</p>
                    <div className="about-trusted-marquee">
                        <div className="about-trusted-logos">
                            {[...TRUSTED_LOGOS, ...TRUSTED_LOGOS].map((logo, index) => {
                                const copy = index >= TRUSTED_LOGOS.length;
                                return (
                                    <img
                                        key={`${logo.name}-${copy ? 'copy' : 'first'}`}
                                        className={`about-trusted-logo${copy ? ' is-copy' : ''}`}
                                        style={{ width: `${logo.width}px` }}
                                        src={logo.src}
                                        alt={copy ? '' : logo.name}
                                        aria-hidden={copy ? 'true' : undefined}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </section>

                <section className="about-statement" ref={statementRef} style={{ '--n': STATEMENT_WORDS.length }}>
                    <div className="about-statement-stage">
                        <p className="about-statement-text">
                            {STATEMENT_WORDS.map(([word, accent], index) => (
                                // eslint-disable-next-line react/no-array-index-key
                                <React.Fragment key={index}>
                                    <span className={`about-statement-word${accent ? ' is-accent' : ''}`} style={{ '--i': index }}>{word}</span>
                                    {' '}
                                </React.Fragment>
                            ))}
                        </p>
                    </div>
                </section>

                <ScaleScene motion={motion} />

                <WorkflowScene />

                <section className="about-section about-demo" id="demo">
                    <div className="about-inner">
                        <p className="about-eyebrow" data-reveal>See it in action</p>
                        <h2 className="about-heading" data-reveal style={{ '--d': 1 }}>Watch the GLKB research agent at work</h2>
                        <p className="about-demo-lede" data-reveal style={{ '--d': 2 }}>
                            A walkthrough of GLKB answering a research question, from the query to the cited answer.
                        </p>
                        <div className="about-demo-frame" data-reveal style={{ '--d': 3 }}>
                            <DemoPlayer />
                        </div>
                    </div>
                </section>

                {LITERATURE_REVIEW_ENABLED && <ReviewScene motion={motion} onStart={startReview} />}

                {/* The blog lives here: /blog sends readers to this section. Placed after the
                    product scenes rather than at the foot of the page, so it is seen. */}
                <section className="about-section about-lab" id="from-the-lab" aria-labelledby="about-lab-heading">
                    <div className="about-inner">
                        <div className="about-lab-head">
                            <div>
                                <p className="about-eyebrow" data-reveal>From the Lab</p>
                                <h2 className="about-display" id="about-lab-heading" data-reveal style={{ '--d': 1 }}>
                                    How GLKB works, from the people who build it.
                                </h2>
                            </div>
                            {railOverflows && (
                                <div className="about-lab-controls">
                                    <button type="button" className="about-lab-arrow" onClick={() => scrollRail(-1)} aria-label="Previous posts">
                                        <ChevronRightIcon className="is-back" />
                                    </button>
                                    <button type="button" className="about-lab-arrow" onClick={() => scrollRail(1)} aria-label="More posts">
                                        <ChevronRightIcon />
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="about-lab-rail" ref={railRef} data-reveal style={{ '--d': 2 }}>
                            {posts.map((post, index) => (
                                <Link className={`about-lab-card${index === 0 ? ' is-new' : ''}`} to={`/blog/${post.slug}`} key={post.slug}>
                                    <span className="about-lab-media">
                                        {post.thumb ? <img src={post.thumb} alt="" loading="lazy" /> : null}
                                    </span>
                                    <span className="about-lab-body">
                                        <span className="about-lab-date">
                                            {index === 0 ? <b>New</b> : null}
                                            {post.date}
                                        </span>
                                        <span className="about-lab-card-title">{post.title}</span>
                                        <span className="about-lab-excerpt">{post.lede}</span>
                                        <span className="about-lab-more">
                                            Read the article
                                            <ChevronRightIcon />
                                        </span>
                                    </span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </section>

                <section className="about-section about-different" id="why">
                    <div className="about-inner">
                        <p className="about-eyebrow" data-reveal>By researcher, for researcher</p>
                        <h2 className="about-heading" data-reveal style={{ '--d': 1 }}>What Makes GLKB Different</h2>
                        <article className="about-evidence" data-reveal style={{ '--d': 2 }}>
                            <div className="about-evidence-text">
                                <h3 className="about-card-title">Explore the supporting evidence</h3>
                                <p className="about-card-body">
                                    GLKB uses retrieved literature to help synthesize answers to biomedical
                                    research questions. References and source excerpts let you review the
                                    supporting evidence, assess its relevance, and identify questions that
                                    need further investigation.
                                </p>
                            </div>
                            <Track className="about-evidence-media">
                                <img src={evidenceImage} alt="A citation list with its source sentences" />
                            </Track>
                        </article>
                        <div className="about-different-grid">
                            {DIFFERENTIATORS.map(([title, body], index) => (
                                <article className="about-card" key={title} data-reveal style={{ '--d': index }}>
                                    <h3 className="about-card-title">{title}</h3>
                                    <p className="about-card-body">{body}</p>
                                </article>
                            ))}
                        </div>
                    </div>
                </section>

                <Track as="section" className="about-section about-graph" id="knowledge-graph">
                    <div className="about-inner about-graph-inner">
                        <div className="about-graph-copy">
                            <p className="about-eyebrow" data-reveal>The Knowledge Graph</p>
                            <h2 className="about-heading about-lines">
                                {['Visualize what', 'the literature knows and', 'where the gaps are.'].map((line, index) => (
                                    // The clipped line is what is watched: its sliding child is
                                    // fully clipped until it moves, so it never "intersects".
                                    <span className="about-line" data-reveal="line" style={{ '--d': index }} key={line}>
                                        <span>{line}</span>
                                    </span>
                                ))}
                            </h2>
                            <p className="about-graph-body" data-reveal style={{ '--d': 3 }}>
                                Explore connections between genes, diseases, drugs, and pathways, then jump
                                directly to the supporting papers. Not just what science has established, but
                                where the evidence runs thin.
                            </p>
                        </div>
                        <div className="about-graph-media">
                            <img src={knowledgeGraphImage} alt="A knowledge graph linking genes, diseases, drugs and variants" />
                        </div>
                    </div>
                </Track>

                <Track as="section" className="about-ask" aria-labelledby="about-ask-heading">
                    <div className="about-ask-head">
                        <p className="about-eyebrow" data-reveal>Ask anything</p>
                        <h2 className="about-heading" id="about-ask-heading" data-reveal style={{ '--d': 1 }}>
                            From a single gene to a whole field.
                        </h2>
                        <p className="about-ask-hint" data-reveal style={{ '--d': 2 }}>
                            Pick a question to see GLKB&rsquo;s answer, with its sources. Free, no sign-in needed.
                        </p>
                    </div>
                    {EXAMPLE_QUESTIONS.map((row, rowIndex) => (
                        <div className={`about-ask-row about-ask-row--${rowIndex + 1}`} key={row[0]}>
                            <ul className="about-ask-track">
                                {row.map((question) => (
                                    <li key={question}>
                                        <Link className="about-ask-chip" {...exampleChatLink(question)}>
                                            <span className="about-ask-text">{question}</span>
                                            <ChevronRightIcon className="about-ask-go" aria-hidden="true" />
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </Track>

                <UseCasesSection />

                <section className="about-section about-numbers" aria-labelledby="about-numbers-heading">
                    <div className="about-inner">
                        <div className="about-numbers-head">
                            <p className="about-eyebrow" data-reveal>By the numbers</p>
                            <h2 className="about-display" id="about-numbers-heading" data-reveal style={{ '--d': 1 }}>
                                The literature, connected.
                            </h2>
                        </div>
                        <div className="about-bento">
                            {NUMBERS.map((item, index) => (
                                <div className={`about-tile about-tile--${item.key}`} key={item.key} data-reveal style={{ '--d': index }}>
                                    <CountUp className="about-tile-value" value={item.value} motion={motion} />
                                    <p className="about-tile-label">{item.label}</p>
                                    {item.key === 'terms' ? (
                                        <ul className="about-tile-types" aria-label="Term types">
                                            {TERM_TYPES.map((type) => <li key={type}>{type}</li>)}
                                        </ul>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
                <section className="about-section about-team" id="team">
                    <div className="about-inner about-team-inner">
                        <img className="about-team-logo" src={teamLogo} alt="Michigan Medicine, University of Michigan" data-reveal />
                        <div className="about-team-copy" data-reveal style={{ '--d': 1 }}>
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
                        <h2 className="about-heading about-faq-heading" data-reveal>Frequently Asked Questions</h2>
                        <div className="about-faq-columns">
                            {faqData.map((item) => {
                                const isOpen = openFaqId === item.id;
                                return (
                                    <details open={isOpen} className={`about-faq-item${isOpen ? ' is-open' : ''}`} key={item.id}>
                                        <summary
                                            className="about-faq-question"
                                            aria-expanded={isOpen}
                                            aria-controls={`faq-${item.id}`}
                                            onClick={(event) => { event.preventDefault(); setOpenFaqId(isOpen ? null : item.id); }}
                                        >
                                            <span>{item.question}</span>
                                            <span className="about-faq-toggle" aria-hidden="true">
                                                {isOpen ? <RemoveIcon /> : <AddIcon />}
                                            </span>
                                        </summary>
                                        <p className="about-faq-answer" id={`faq-${item.id}`}>{item.answer}</p>
                                    </details>
                                );
                            })}
                        </div>
                    </div>
                </section>

                <SiteFooter onViewDemo={openDemo} />
            </div>
            <DemoModal open={demoOpen} onClose={closeDemo} />
        </>
    );
};

export default AboutPage;

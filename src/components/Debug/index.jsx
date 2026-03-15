import './scoped.css';

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import stepLabels from '../LLMAgent/step.json';

const STEP_LABELS = stepLabels || {};
const STEP_SEQUENCE = [
    'load_skill',
    'load_skill_resource',
    'get_database_schema',
    'QuestionRouterAgent',
    'search_pubmed',
    'search_pubmed',
    'article_search',
    'fetch_abstract',
    'fetch_abstract',
    'find_similar_articles',
    'get_citing_articles',
    'cite_evidence',
    'FinalAnswerAgent',
];

const OUT_MS = 140;
const BUFFER_MS = 80;
const IN_MS = 180;
const STEP_INTERVAL_MS = 2200;

function DebugPage() {
    const sequence = useMemo(
        () => STEP_SEQUENCE.map((key) => STEP_LABELS[key] || key),
        []
    );
    const [stepIndex, setStepIndex] = useState(0);
    const [targetLabel, setTargetLabel] = useState('');
    const [displayLabel, setDisplayLabel] = useState('');
    const [phase, setPhase] = useState('idle');
    const timersRef = useRef([]);
    const displayRef = useRef('');

    useEffect(() => {
        if (!sequence.length) return;
        setTargetLabel(`${sequence[0]}...`);
    }, [sequence]);

    useEffect(() => {
        if (!sequence.length) return;
        const intervalId = setInterval(() => {
            setStepIndex((prev) => (prev + 1) % sequence.length);
        }, STEP_INTERVAL_MS);
        return () => clearInterval(intervalId);
    }, [sequence.length]);

    useEffect(() => {
        if (!sequence.length) return;
        setTargetLabel(`${sequence[stepIndex]}...`);
    }, [sequence, stepIndex]);

    useEffect(() => {
        const clearTimers = () => {
            timersRef.current.forEach((timerId) => clearTimeout(timerId));
            timersRef.current = [];
        };

        clearTimers();

        if (!targetLabel) {
            displayRef.current = '';
            setDisplayLabel('');
            setPhase('idle');
            return undefined;
        }

        const current = displayRef.current;
        if (!current) {
            displayRef.current = targetLabel;
            setDisplayLabel(targetLabel);
            setPhase('idle');
            return undefined;
        }

        if (current === targetLabel) {
            return undefined;
        }

        setPhase('out');
        const outTimer = setTimeout(() => {
            displayRef.current = targetLabel;
            setDisplayLabel(targetLabel);
            setPhase('in');
            const inTimer = setTimeout(() => {
                setPhase('idle');
            }, IN_MS);
            timersRef.current.push(inTimer);
        }, OUT_MS + BUFFER_MS);
        timersRef.current.push(outTimer);

        return clearTimers;
    }, [targetLabel]);

    return (
        <div className="debug-page">
            <div className="debug-card">
                <div className="debug-title">Loading Step Animation</div>
                <div className="debug-step-row">
                    <span
                        className={`loading-step-label${phase !== 'idle' ? ` loading-step-label--${phase}` : ''
                            }`}
                    >
                        {displayLabel}
                    </span>
                </div>
                <div className="debug-meta">
                    Step {stepIndex + 1} of {sequence.length}
                </div>
            </div>
        </div>
    );
}

export default DebugPage;

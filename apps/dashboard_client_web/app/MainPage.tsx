'use client';

import React, { useState, useEffect, useRef } from 'react';
import clsx from 'clsx';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ExternalLink, GitFork } from 'lucide-react';

// Main Terminal Profile Component
const TerminalProfile = () => {
    const [loading, setLoading] = useState(true);
    const [progress, setProgress] = useState(0);
    const [activeSection, setActiveSection] = useState('experience');

    const summaryRef = useRef(null);
    const experienceRef = useRef(null);
    const projectsRef = useRef(null);
    const contributionsRef = useRef(null);
    const skillsRef = useRef(null);
    const educationRef = useRef(null);
    const certificationsRef = useRef(null);

    const sectionRefs = {
        summary: summaryRef,
        experience: experienceRef,
        skills: skillsRef,
        projects: projectsRef,
        contributions: contributionsRef,
        education: educationRef,
        certifications: certificationsRef,
    };

    useEffect(() => {
        const timer = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(timer);
                    setLoading(false);
                    return 100;
                }
                return prev + 2;
            });
        }, 30);

        return () => clearInterval(timer);
    }, []);

    const scrollToSection = (section: string) => {
        setActiveSection(section);
        // @ts-expect-error sectionRefs is indexed by dynamic string key
        sectionRefs[section].current?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
        });
    };

    const experiences = [
        {
            title: 'Software Engineer',
            company: 'ADRIEL',
            location: 'Seoul, South Korea',
            period: '11/2021–05/2024',
            achievements: [
                'Migrated dashboard from Vue to React with Next.js, improving frontend loading time by 50%.',
                'Engineered an editable dashboard-snapshot system with RxJS, reducing storage by 90%.',
                'Built a WYSIWYG text-editor widget with the Quill library, reaching 100% client adoption.',
                'Documented frontend setup and business logic using Notion and Figma, reducing technical assistance time by 50%.',
            ],
        },
        {
            title: 'Software Developer',
            company: 'DIV',
            location: 'Seoul, South Korea',
            period: '05/2021–10/2021',
            achievements: [
                'Integrated hotel-booking into a rent-a-car platform and migrated flight-booking to a new broker, lifting revenue by 3%.',
            ],
        },
        {
            title: 'Software Engineer',
            company: 'BabelTop',
            location: 'Seoul, South Korea',
            period: '07/2019–11/2019',
            achievements: [
                'Developed a translator-approval process and rebuilt login, sign-up, and translator-resume features for a translation SaaS, using JavaScript, React, Redux, and Redux-Saga.',
            ],
        },
        {
            title: 'Software Engineer',
            company: 'RECOBELL',
            location: 'Seoul, South Korea',
            period: '02/2018–07/2019',
            achievements: [
                'Operated a cloud-based recommendation system using Java, Spring, MySQL, and AWS, processing 500M+ user logs monthly.',
                'Maintained and extended data pipelines, a SQL-based recommendation engine, and APIs using AWS Kinesis, S3, and Spring.',
            ],
        },
    ];

    const projects = [
        {
            name: 'Weather & Kalshi Arbitrage Pipeline',
            tech: ['Python', 'Kafka', 'ClickHouse', 'k3s'],
            period: '10/2026–Present',
            desc: 'Streamed real-time weather, BTC, and Kalshi market data through Kafka into ClickHouse. Ran a hybrid k3s cluster (Cloud + on-prem via Tailscale) with a Next.js/Node monorepo. Predicted per-unit temperature and price up/down percentages to surface arbitrage on the Kalshi orderbook.',
        },
        {
            name: 'MapReduce Infrastructure Implementation',
            tech: ['C++', 'gRPC', 'protobuf'],
            period: '11/2024',
            desc: 'Designed and implemented a simplified distributed MapReduce infrastructure based on "MapReduce: Simplified Data Processing on Large Clusters" by Jeffrey Dean and Sanjay Ghemawat.',
        },
    ];

    const contributions = [
        {
            name: 'KCDD Market — Code for Kansas City',
            tech: ['Civic Tech', 'Open Source'],
            period: '2026–Current',
            desc: 'Contributing features and improvements to a civic-tech marketplace platform serving the Kansas City community; developing in a working fork (kcdd-market_v2) toward an upstream merge into the official Code for KC repository, a Code for America brigade.',
            links: [
                {
                    label: 'Fork',
                    href: 'https://github.com/intothedeep/kcdd-market_v2',
                    type: 'github' as const,
                },
                {
                    label: 'Upstream',
                    href: 'https://github.com/codeforkansascity/kcdd-market2',
                    type: 'github' as const,
                },
                {
                    label: 'Code for KC',
                    href: 'https://codeforkc.org/',
                    type: 'web' as const,
                },
            ],
        },
    ];

    const skills = {
        Languages: [
            'Java',
            'Python',
            'C/C++',
            'TypeScript/JavaScript',
            'SQL',
            'Rust',
        ],
        'Data & Streaming': [
            'Kafka',
            'AWS Kinesis',
            'PostgreSQL/TimescaleDB',
            'Supabase',
            'MySQL',
            'ClickHouse',
            'Redis',
            'AWS Redshift',
            'Elasticsearch',
            'MongoDB',
        ],
        Backend: [
            'Spring Boot & Security',
            'JPA',
            'MyBatis',
            'FastAPI',
            'Node',
            'REST/GraphQL',
            'gRPC/Protobuf',
            'JUnit',
        ],
        Frontend: [
            'React.js',
            'React Native',
            'Next.js',
            'Vue.js',
            'TanStack',
            'Jotai',
            'RxJS',
            'Tailwind',
            'CSS/Sass',
            'HTML',
            'Storybook',
        ],
        'Cloud/DevOps': [
            'AWS (EC2/S3/RDS/EBS)',
            'Azure',
            'Vercel',
            'Docker',
            'k3s',
            'Tailscale',
            'Git',
            'Gradle',
            'Maven',
            'Webpack',
            'Jest',
            'Prometheus',
            'Grafana',
            'Monorepo',
        ],
        ML: [
            'PyTorch',
            'TensorFlow',
            'LangChain/LangGraph',
            'Prompt Engineering',
            'Claude',
            'OpenAI',
            'Gemini',
        ],
    };

    const education = [
        {
            school: 'The University of Texas Rio Grande Valley',
            degree: 'M.S. Computer Science, Graduate Select Scholarship',
            period: '05/2027',
            courses: [
                'Graduate Teaching Assistant for two courses: Deep Learning and AI in Python, 08/2026 – Present',
            ],
        },
        {
            school: 'University of Central Missouri',
            degree: 'M.S. Computer Science, Cybersecurity & Information Assurance, Graduate Achievement Award',
            period: '05/2026',
            courses: [
                'Graduate Assistant, 01/2026 – 05/2026',
                'Algorithms',
                'Compiler Design',
                'AI',
                'Neural Network and Deep Learning',
            ],
        },
        {
            school: 'Georgia Institute of Technology',
            degree: 'M.S. Computer Science (Online)',
            period: '01/2024 - 12/2027',
            courses: ['Operating Systems', 'Networks'],
        },
        {
            school: 'University of California, Los Angeles',
            degree: 'B.S. Mathematics-Economics',
            period: '03/2013',
            courses: [],
        },
    ];

    const stats = [
        { label: 'Experience', value: '5+ Years', icon: '📊' },
        { label: 'Education', value: 'M.S. CS', icon: '🎓' },
        { label: 'Languages', value: '10+', icon: '💻' },
        { label: 'Cloud', value: 'AWS', icon: '☁️' },
        { label: 'Performance', value: '50%↓', icon: '⚡' },
        { label: 'Scale', value: '500M+/mo', icon: '📈' },
    ];

    const navItems = [
        { id: 'summary', label: 'SUMMARY' },
        { id: 'experience', label: 'EXPERIENCE' },
        { id: 'skills', label: 'SKILLS' },
        { id: 'projects', label: 'PROJECTS' },
        { id: 'contributions', label: 'OPEN_SOURCE' },
        { id: 'education', label: 'EDUCATION' },
        { id: 'certifications', label: 'CERTIFICATIONS' },
    ];

    return (
        <div className="min-h-screen bg-background text-foreground font-mono">
            <div className="container mx-auto p-4 md:p-8">
                {/* Header */}
                <Card className="mb-6 bg-card border-primary">
                    <CardHeader>
                        <div className="relative w-full flex flex-col justfiy-center items-center gap-4">
                            {/* Profile Image */}

                            {/* ASCII Art and Info */}
                            <div
                                className={clsx(
                                    'flex gap-1.5 flex-1',
                                    'flex-col',
                                    'lg:flex-row'
                                )}
                            >
                                <div
                                    className={clsx(
                                        'flex items-center justify-center flex-shrink-0',
                                        ''
                                    )}
                                >
                                    <div className="w-24 h-24 md:w-32 md:h-32 border-2 border-primary bg-secondary flex items-center justify-center">
                                        <span className="text-4xl md:text-5xl">
                                            👨‍💻
                                        </span>
                                    </div>
                                </div>
                                {/* 모바일·태블릿용 (2줄 네임 블록) — ASCII는 lg+에서만 */}
                                <div className="flex flex-col items-center justify-center text-primary text-3xl font-bold lg:hidden leading-tight">
                                    <span>TAEK</span>
                                    <span>LIM</span>
                                </div>

                                {/* ASCII banner: pin a system monospace stack
                                    (NOT the inherited IBM Plex Mono — its
                                    box-drawing glyphs leave gaps that break the
                                    art). leading-none keeps the vertical bars
                                    connected across lines. */}
                                <pre
                                    style={{
                                        fontFamily:
                                            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                                    }}
                                    className="hidden leading-none lg:block text-sm text-primary overflow-x-auto whitespace-pre"
                                >
                                    {`╔═══════════════════════════════════════════════════════════════╗
║  ████████╗ █████╗ ███████╗██╗  ██╗    ██╗     ██╗███╗   ███╗  ║
║  ╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝    ██║     ██║████╗ ████║  ║
║     ██║   ███████║█████╗  █████╔╝     ██║     ██║██╔████╔██║  ║
║     ██║   ██╔══██║██╔══╝  ██╔═██╗     ██║     ██║██║╚██╔╝██║  ║
║     ██║   ██║  ██║███████╗██║  ██╗    ███████╗██║██║ ╚═╝ ██║  ║
║     ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝    ╚══════╝╚═╝╚═╝     ╚═╝  ║
╚═══════════════════════════════════════════════════════════════╝`}
                                </pre>
                            </div>

                            <CardDescription className="mt-2">
                                TX | tio.taek.lim@gmail.com | Github:{' '}
                                <a
                                    href="https://github.com/intothedeep"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                >
                                    intothedeep
                                </a>{' '}
                                |{' '}
                                <a
                                    href="https://www.linkedin.com/in/tiotaeklim/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                >
                                    in/tiotaeklim
                                </a>
                                {/* Warrensburg, MO | 660-238-5036 | */}
                                {/* tio.taek.lim@gmail.com | Github: tradelunch */}
                            </CardDescription>
                        </div>
                    </CardHeader>
                </Card>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                    {stats.map((stat, idx) => (
                        <Card
                            key={idx}
                            className="bg-card border-muted"
                        >
                            <CardContent className="p-4 text-center">
                                <div className="text-2xl mb-1">{stat.icon}</div>
                                <div className="text-xs text-foreground">
                                    {stat.label}
                                </div>
                                <div className="text-sm font-bold text-primary">
                                    {stat.value}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Loading */}
                {loading && (
                    <Card className="mb-6 bg-card">
                        <CardContent className="p-4">
                            <div className="text-sm mb-2 text-foreground">
                                &gt; STATUS: CONNECTING TO SERVER...
                            </div>
                            <Progress
                                value={progress}
                                className="h-2"
                            />
                            <div className="text-right text-xs mt-1 text-foreground">
                                {progress}%
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Navigation */}
                {!loading && (
                    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur mb-10 pb-0">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {navItems.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => scrollToSection(item.id)}
                                    className={`px-4 py-2 text-sm font-mono transition-colors ${
                                        activeSection === item.id
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                                    }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Content - All Sections Rendered */}
                {!loading && (
                    <div className="space-y-8">
                        {/* Summary Section */}
                        <div
                            ref={summaryRef}
                            id="summary"
                            className="scroll-mt-32"
                        >
                            <Card className="bg-card">
                                <CardHeader>
                                    <CardTitle className="text-primary">
                                        &gt; SUMMARY.txt
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm">
                                        End-to-end data engineer with 5+ years
                                        turning raw data into real-time
                                        decisions across the lifecycle:
                                        collection, streaming ingestion,
                                        storage, distributed processing, and ML.
                                        Worked on a cloud recommendation
                                        platform on AWS and a high-volume,
                                        multi-channel ad-analytics SaaS. M.S.
                                        Computer Science at UTRGV (May 2027).
                                        Seeking roles building large-scale,
                                        data-intensive systems.
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Experience Section */}
                        <div
                            ref={experienceRef}
                            id="experience"
                            className="scroll-mt-32"
                        >
                            <Card className="bg-card">
                                <CardHeader>
                                    <CardTitle className="text-primary">
                                        &gt; PROFESSIONAL_EXPERIENCE.log
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {experiences.map((exp, idx) => (
                                        <div
                                            key={idx}
                                            className="border-l-2 border-primary pl-4"
                                        >
                                            <h3 className="text-lg font-bold text-foreground">
                                                {exp.title}
                                            </h3>
                                            <p className="text-sm text-foreground">
                                                {exp.company} | {exp.location}
                                            </p>
                                            <p className="text-xs text-foreground mb-3">
                                                {exp.period}
                                            </p>
                                            <ul className="space-y-1">
                                                {exp.achievements.map(
                                                    (achievement, i) => (
                                                        <li
                                                            key={i}
                                                            className="text-sm"
                                                        >
                                                            • {achievement}
                                                        </li>
                                                    )
                                                )}
                                            </ul>
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Skills Section */}
                        <div
                            ref={skillsRef}
                            id="skills"
                            className="scroll-mt-32"
                        >
                            <Card className="bg-card">
                                <CardHeader>
                                    <CardTitle className="text-primary">
                                        &gt; SKILLS.dat
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {Object.entries(skills).map(
                                        ([category, items]) => (
                                            <div key={category}>
                                                <h3 className="text-lg font-bold text-primary mb-3">
                                                    [{category}]
                                                </h3>
                                                <div className="flex flex-wrap gap-2">
                                                    {items.map((skill, idx) => (
                                                        <Badge
                                                            key={idx}
                                                            variant="secondary"
                                                            className="text-xs"
                                                        >
                                                            {skill}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Projects Section */}
                        <div
                            ref={projectsRef}
                            id="projects"
                            className="scroll-mt-32"
                        >
                            <Card className="bg-card">
                                <CardHeader>
                                    <CardTitle className="text-primary">
                                        &gt; PROJECTS.json
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {projects.map((proj, idx) => (
                                        <Card
                                            key={idx}
                                            className="bg-secondary"
                                        >
                                            <CardHeader>
                                                <CardTitle className="text-base">
                                                    {proj.name}
                                                </CardTitle>
                                                <CardDescription>
                                                    {proj.period}
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="flex flex-wrap gap-2 mb-3">
                                                    {proj.tech.map(
                                                        (tech, i) => (
                                                            <Badge
                                                                key={i}
                                                                variant="outline"
                                                            >
                                                                {tech}
                                                            </Badge>
                                                        )
                                                    )}
                                                </div>
                                                <p className="text-sm">
                                                    {proj.desc}
                                                </p>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Open Source Contributions Section */}
                        <div
                            ref={contributionsRef}
                            id="contributions"
                            className="scroll-mt-32"
                        >
                            <Card className="bg-card">
                                <CardHeader>
                                    <CardTitle className="text-primary">
                                        &gt; OPEN_SOURCE.json
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {contributions.map((proj, idx) => (
                                        <Card
                                            key={idx}
                                            className="bg-secondary"
                                        >
                                            <CardHeader>
                                                <CardTitle className="text-base">
                                                    {proj.name}
                                                </CardTitle>
                                                <CardDescription>
                                                    {proj.period}
                                                </CardDescription>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="flex flex-wrap gap-2 mb-3">
                                                    {proj.tech.map(
                                                        (tech, i) => (
                                                            <Badge
                                                                key={i}
                                                                variant="outline"
                                                            >
                                                                {tech}
                                                            </Badge>
                                                        )
                                                    )}
                                                </div>
                                                <p className="text-sm">
                                                    {proj.desc}
                                                </p>
                                                <div className="flex flex-wrap gap-3 mt-3">
                                                    {proj.links.map(
                                                        (link, i) => (
                                                            <a
                                                                key={i}
                                                                href={link.href}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                                                            >
                                                                {link.type ===
                                                                'github' ? (
                                                                    <GitFork className="h-3 w-3" />
                                                                ) : (
                                                                    <ExternalLink className="h-3 w-3" />
                                                                )}
                                                                {link.label}
                                                            </a>
                                                        )
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                    <p className="text-xs text-muted-foreground">
                                        &gt; Building open source civic-tech —
                                        writing code that gives back to the
                                        community.
                                    </p>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Education Section */}
                        <div
                            ref={educationRef}
                            id="education"
                            className="scroll-mt-32"
                        >
                            <Card className="bg-card">
                                <CardHeader>
                                    <CardTitle className="text-primary">
                                        &gt; EDUCATION.txt
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {education.map((edu, idx) => (
                                        <div
                                            key={idx}
                                            className="border-l-2 border-primary pl-4"
                                        >
                                            <h3 className="text-lg font-bold text-foreground">
                                                {edu.school}
                                            </h3>
                                            <p className="text-sm text-foreground">
                                                {edu.degree}
                                            </p>
                                            <p className="text-xs text-foreground mb-2">
                                                {edu.period}
                                            </p>
                                            {edu.courses.length > 0 && (
                                                <div className="flex flex-wrap gap-2">
                                                    {edu.courses.map(
                                                        (course, i) => (
                                                            <Badge
                                                                key={i}
                                                                variant="outline"
                                                                className="text-xs"
                                                            >
                                                                {course}
                                                            </Badge>
                                                        )
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Certifications, Licenses & Awards Section */}
                        <div
                            ref={certificationsRef}
                            id="certifications"
                            className="scroll-mt-32"
                        >
                            <Card className="bg-card">
                                <CardHeader>
                                    <CardTitle className="text-primary">
                                        &gt; CERTIFICATIONS_LICENSES_AWARDS.txt
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-1 text-sm">
                                    <p>
                                        • AWS Certified AI Practitioner, 08/2026
                                    </p>
                                    <p>
                                        • SQL Developer Certificate, Korea Data
                                        Agency, 07/2023
                                    </p>
                                    <p>
                                        • CS Engineer Information Processing
                                        License, HRDK, 11/2018
                                    </p>
                                    <p>• Global Vision Scholarship, UCM</p>
                                    <p>
                                        • Graduate Achievement Award, UCM $1,000
                                    </p>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <Card className="mt-6 bg-card border-primary">
                    <CardContent className="p-4 text-center text-sm">
                        <div className="text-primary mb-2">
                            <span className="animate-pulse">▋</span> STATUS:
                            READY FOR OPPORTUNITIES
                        </div>
                        <div className="text-foreground">
                            Last Updated: 10/30/2026
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default TerminalProfile;

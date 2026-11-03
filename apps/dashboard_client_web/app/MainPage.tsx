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
    const researchRef = useRef(null);
    const projectsRef = useRef(null);
    const contributionsRef = useRef(null);
    const skillsRef = useRef(null);
    const educationRef = useRef(null);
    const certificationsRef = useRef(null);

    const sectionRefs = {
        summary: summaryRef,
        experience: experienceRef,
        research: researchRef,
        projects: projectsRef,
        contributions: contributionsRef,
        skills: skillsRef,
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
            title: 'Senior Software Engineer',
            company: 'ADRIEL',
            location: 'Seoul, South Korea',
            period: '11/2021–05/2024',
            achievements: [
                'Cut most dashboard loads from 3s to under 1s via a React/Next.js migration, RxJS event control, and a server-aggregation API redesign.',
                'Traced slow dashboards and wrong totals to browser-side aggregation and proposed moving aggregation and caching to the server.',
                'Reduced client report generation time from 2 hours to 1 hour by developing a PDF export feature with layout conversion algorithms.',
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
            company: 'BABELTOP',
            location: 'Seoul, South Korea',
            period: '07/2019–11/2019',
            achievements: [
                'Built translator-approval, login, sign-up, and resume features for a translation SaaS using React, Redux, and Redux-Saga.',
            ],
        },
        {
            title: 'Software Engineer',
            company: 'RECOBELL',
            location: 'Seoul, South Korea',
            period: '02/2018–07/2019',
            achievements: [
                'Operated a cloud-based recommendation system using Java, Spring, MySQL, and AWS, processing 600M+ user logs monthly.',
                'Built keyword-based book recommendation APIs for Korea’s No. 1 bookstore ($500M annual revenue), handling 1M+ daily requests.',
                'Maintained and extended data pipelines, a SQL-based recommendation engine, and APIs using AWS Kinesis, S3, and Java.',
            ],
        },
    ];

    const research = [
        {
            title: 'Graduate Research and Teaching Assistant',
            company: 'UTRGV',
            location: 'Edinburg, TX',
            period: '08/2026–Present',
            achievements: [
                'Generating nocturnal bird flight calls from 30–130 samples using open-source audio models to support rare-species research.',
                'As Teaching Assistant, built a PyTorch DDPM on SLURM, improving public FID from 30.26 to 6.10 under a 10M-parameter cap.',
                'Built a PyTorch ResNet ensemble reaching 93.2% private accuracy on 100 classes under a 5M-parameter cap, across 158 training runs.',
            ],
        },
    ];

    const projects = [
        {
            name: 'Weather and BTC Prediction-Market Data Pipeline',
            tech: ['TypeScript', 'Kafka', 'ClickHouse', 'k3s'],
            period: '04/2026–Present',
            desc: 'Collected Kalshi, Polymarket, and 60-city weather data into ClickHouse on a Mac mini, with 39 Kafka topics and k3s on Oracle Cloud. Deduplicated rows with idempotency keys and ClickHouse ReplacingMergeTree under one Protobuf schema.',
        },
        {
            name: 'Personal Blog and Portfolio',
            tech: [
                'Next.js',
                'Express',
                'Postgres',
                'GCP',
                'OCI',
                'Cloudflare',
            ],
            period: '10/2025–Present',
            desc: 'Built a Python publisher from an NFS-mounted home NAS to Postgres and Oracle Object Storage, with Claude-generated tags. Restored a suspended site and cut Supabase egress from 40+ GB a week to 2.47 GB in October using GCP and Oracle storage at $0. Traced 16 traffic causes and added Cloudflare caching and rate limiting: a 640-request test on cached URLs reached the VM 0 times.',
        },
        {
            name: 'MapReduce Infrastructure Implementation',
            tech: ['C++', 'gRPC', 'protobuf'],
            period: '11/2024',
            desc: 'Implemented a simplified distributed MapReduce framework with asynchronous gRPC, based on the Dean and Ghemawat paper.',
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
        Languages: ['Java', 'Python', 'C/C++', 'TypeScript/JavaScript', 'SQL'],
        Data: [
            'Kafka',
            'AWS Kinesis',
            'PostgreSQL/TimescaleDB',
            'Supabase',
            'MySQL',
            'ClickHouse',
            'Redis',
            'Grafana',
        ],
        ML: ['PyTorch', 'TensorFlow', 'pandas', 'NumPy', 'SLURM'],
        Backend: [
            'Spring Boot/Security',
            'JPA',
            'MyBatis',
            'FastAPI',
            'Express',
            'Node',
            'Electron',
            'REST/GraphQL',
            'gRPC/Protobuf',
            'JUnit',
        ],
        Cloud: [
            'AWS (EC2/S3/RDS/EBS)',
            'Azure',
            'GCP',
            'Oracle Cloud',
            'Cloudflare',
            'Vercel',
            'Clerk',
        ],
        DevOps: [
            'Docker',
            'Kubernetes (k3s)',
            'Kustomize',
            'GitHub Actions',
            'k6',
            'Tailscale',
            'Git',
            'Gradle',
            'Maven',
            'Webpack',
            'Jest',
        ],
    };

    const education = [
        {
            school: 'The University of Texas Rio Grande Valley',
            degree: 'MS Computer Science, Graduate Select Scholarship',
            period: '05/2027',
            courses: [],
        },
        {
            school: 'University of Central Missouri',
            degree: 'MS Computer Science, Cybersecurity and Information Assurance, Graduate Student Achievement Award',
            period: '01/2025–05/2026',
            courses: [
                'Graduate Assistant, 01/2026–05/2026',
                'Algorithms',
                'Compiler Design',
                'AI',
                'Neural Network and Deep Learning',
            ],
        },
        {
            school: 'Georgia Institute of Technology',
            degree: 'MS Computer Science (Online)',
            period: '01/2024 - 12/2027',
            courses: ['Operating Systems', 'Networks'],
        },
        {
            school: 'University of California, Los Angeles',
            degree: 'BS Mathematics-Economics',
            period: '03/2013',
            courses: [],
        },
    ];

    const stats = [
        { label: 'Experience', value: '~5 Years', icon: '📊' },
        { label: 'Education', value: 'MS CS', icon: '🎓' },
        { label: 'Languages', value: '5+', icon: '💻' },
        { label: 'Cloud', value: 'AWS/GCP/OCI', icon: '☁️' },
        { label: 'Dashboard load', value: '3s→<1s', icon: '⚡' },
        { label: 'Scale', value: '600M+/mo', icon: '📈' },
    ];

    const navItems = [
        { id: 'summary', label: 'SUMMARY' },
        { id: 'experience', label: 'EXPERIENCE' },
        { id: 'research', label: 'RESEARCH' },
        { id: 'projects', label: 'PROJECTS' },
        { id: 'contributions', label: 'OPEN_SOURCE' },
        { id: 'skills', label: 'SKILLS' },
        { id: 'education', label: 'EDUCATION' },
        { id: 'certifications', label: 'CERTIFICATIONS' },
    ];

    const renderRoles = (roles: typeof experiences) =>
        roles.map((role, idx) => (
            <div
                key={idx}
                className="border-l-2 border-primary pl-4"
            >
                <h3 className="text-lg font-bold text-foreground">
                    {role.title}
                </h3>
                <p className="text-sm text-foreground">
                    {role.company} | {role.location}
                </p>
                <p className="text-xs text-foreground mb-3">{role.period}</p>
                <ul className="space-y-1">
                    {role.achievements.map((achievement, i) => (
                        <li
                            key={i}
                            className="text-sm"
                        >
                            • {achievement}
                        </li>
                    ))}
                </ul>
            </div>
        ));

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
                                TX | tio.taek.lim@gmail.com | GitHub:{' '}
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
                                        Software engineer with about 5 years
                                        across the data lifecycle: collection,
                                        streaming ingestion, storage, and
                                        visualization, on a cloud recommendation
                                        platform on AWS (600M+ logs monthly) and
                                        a multi-channel ad-analytics SaaS. MS
                                        Computer Science at UTRGV (05/2027),
                                        researching generative AI and assisting
                                        a Deep Learning course. Seeking software
                                        and data engineering roles.
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
                                    {renderRoles(experiences)}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Research and Teaching Section */}
                        <div
                            ref={researchRef}
                            id="research"
                            className="scroll-mt-32"
                        >
                            <Card className="bg-card">
                                <CardHeader>
                                    <CardTitle className="text-primary">
                                        &gt; RESEARCH_AND_TEACHING.log
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    {renderRoles(research)}
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
                                        • Graduate Student Achievement Award,
                                        UCM $1,000
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
                            Last Updated: 11/03/2026
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default TerminalProfile;

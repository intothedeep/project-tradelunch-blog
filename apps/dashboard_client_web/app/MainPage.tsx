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

import { ScrollToTopButton } from '@/app/ScrollToTop';

// Main Terminal Profile Component
const TerminalProfile = () => {
    const [loading, setLoading] = useState(true);
    const [progress, setProgress] = useState(0);
    const [activeSection, setActiveSection] = useState('experience');

    const experienceRef = useRef(null);
    const projectsRef = useRef(null);
    const contributionsRef = useRef(null);
    const skillsRef = useRef(null);
    const educationRef = useRef(null);

    const sectionRefs = {
        experience: experienceRef,
        projects: projectsRef,
        contributions: contributionsRef,
        skills: skillsRef,
        education: educationRef,
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
            title: 'Graduate Assistant',
            company: 'University of Central Missouri',
            location: 'Warrensburg, Missouri, USA',
            period: '01/2026–Current',
            achievements: [
                'Built data pipelines to collect and process weather, cryptocurrency, and prediction market (Kalshi) data from external APIs, stored as time-series in ClickHouse',
                'Deployed hybrid k3s infrastructure across cloud and local instances via Tailscale VPN',
                'Applied machine learning and deep learning to predictive modeling, feature engineering, and statistical analysis for forecasting',
            ],
        },
        {
            title: 'Senior Software Engineer (Frontend)',
            company: 'Adriel',
            location: 'Seoul, South Korea',
            period: '11/2021–05/2024',
            achievements: [
                'Reduced frontend loading time by 50% - Vue2 to React/Next.js migration',
                'Reduced report generation time by 50% - PDF export with layout algorithms',
                'Built WYSIWYG editor - 100% customer adoption',
                'Cross-platform React Native development',
                'Led JavaScript & RxJS training sessions',
            ],
        },
        {
            title: 'Software Engineer',
            company: 'Recobell',
            location: 'Seoul, South Korea',
            period: '02/2018–07/2019',
            achievements: [
                'Cloud recommendation system - 20M daily events',
                'Stack: Java, Spring, PostgreSQL, AWS, Redshift',
                'Maintained: log collector, Kinesis, recommendation engine, API',
                'Led keyword-based book recommendation - $500M revenue client',
            ],
        },
    ];

    const projects = [
        {
            name: 'Time-Series Predictive Analytics Platform',
            tech: ['Python', 'ClickHouse', 'k3s', 'Kafka'],
            period: '04/2026–Current',
            desc: 'Data pipelines collecting weather, crypto, and prediction-market (Kalshi) data into ClickHouse; hybrid k3s across cloud/local via Tailscale VPN; ML/DL forecasting.',
        },
        {
            name: 'MapReduce Infrastructure',
            tech: ['C++', 'gRPC', 'protobuf'],
            period: '11/2024',
            desc: 'Distributed MapReduce based on Dean & Ghemawat paper',
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
            'JavaScript/TypeScript',
            'Java',
            'Python',
            'C/C++',
            'Rust',
            'SQL',
            'HTML/CSS/Sass',
        ],
        Frontend: [
            'React.js',
            'React Native',
            'Next.js',
            'Vue.js',
            'TanStack',
            'Jotai',
            'RxJS',
            'Tailwind CSS',
            'Storybook',
        ],
        Backend: [
            'FastAPI',
            'Spring Boot & Security',
            'Node.js',
            'REST/GraphQL',
            'gRPC/Protobuf',
            'JUnit',
            'JPA',
            'MyBatis',
        ],
        Database: [
            'PostgreSQL',
            'MySQL',
            'ClickHouse',
            'Redis',
            'AWS Redshift',
            'Elasticsearch',
            'MongoDB',
        ],
        'AI / ML': [
            'PyTorch',
            'TensorFlow',
            'LangChain/LangGraph',
            'Prompt Engineering',
            'Claude',
            'OpenAI',
            'Gemini',
        ],
        'Cloud / DevOps': [
            'AWS',
            'Azure',
            'Docker',
            'Prometheus',
            'Grafana',
            'k3s',
            'Kafka',
        ],
        Tools: ['Git', 'Gradle', 'Maven', 'Webpack', 'Jest', 'Monorepo'],
    };

    const education = [
        {
            school: 'University of Central Missouri',
            degree: 'M.S. Computer Science',
            period: '01/2025 – 05/2027 (Expected)',
            courses: [
                'Algorithms',
                'Compiler Design',
                'AI',
                'Neural Network and Deep Learning',
            ],
        },
        {
            school: 'Georgia Institute of Technology',
            degree: 'M.S. Computer Science (Online)',
            period: '01/2024 - 12/2026',
            courses: ['Operating Systems', 'Networks'],
        },
        {
            school: 'UCLA',
            degree: 'B.S. Mathematics-Economics',
            period: '03/2013',
            courses: [],
        },
    ];

    const stats = [
        { label: 'Experience', value: '5 Years', icon: '📊' },
        { label: 'Education', value: 'M.S. CS', icon: '🎓' },
        { label: 'Languages', value: '10+', icon: '💻' },
        { label: 'Cloud', value: 'AWS', icon: '☁️' },
        { label: 'Performance', value: '50%↓', icon: '⚡' },
        { label: 'Scale', value: '20M/day', icon: '📈' },
    ];

    const navItems = [
        { id: 'experience', label: 'EXPERIENCE' },
        { id: 'projects', label: 'PROJECTS' },
        { id: 'contributions', label: 'OPEN_SOURCE' },
        { id: 'skills', label: 'SKILLS' },
        { id: 'education', label: 'EDUCATION' },
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
                                    'md:flex-row'
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
                                {/* 모바일용 (2줄 텍스트) */}
                                <div className="flex flex-col items-center justify-center text-primary text-3xl font-bold md:hidden leading-tight">
                                    <span>TAEK LIM</span>
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
                                    className="hidden leading-none md:block text-xs md:text-sm text-primary scale-[0.6] md:scale-100 overflow-x-auto whitespace-pre"
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
                                Warrensburg, MO | tio.taek.lim@gmail.com |
                                Github: tradelunch | in/tiotaeklim
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
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
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
                                    <Card className="bg-secondary border-primary">
                                        <CardHeader>
                                            <CardTitle className="text-base">
                                                🏆 ACHIEVEMENTS
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-1 text-sm">
                                            <p>
                                                • Global Vision Scholarship, UCM
                                            </p>
                                            <p>
                                                • Graduate Student Achievement
                                                Award, UCM $1,000
                                            </p>
                                            <p>• SQL Developer Certificate</p>
                                            <p>
                                                • CS Engineer Information
                                                Processing License
                                            </p>
                                        </CardContent>
                                    </Card>
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
                            Available: 05/2026 | Last Updated: 6/26/2026
                        </div>
                    </CardContent>
                </Card>
            </div>

            <ScrollToTopButton />
        </div>
    );
};

export default TerminalProfile;

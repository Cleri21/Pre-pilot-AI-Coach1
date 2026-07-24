import { Link } from "react-router-dom";
import HealthStatus from "../components/HealthStatus.jsx";

const features = [
  {
    to: "/chat",
    icon: "💬",
    title: "AI Coach",
    description:
      "Ask placement-related questions and chat with an AI assistant.",
  },
];

export default function Home() {
  return (
    <div className="page">
      <section className="hero">
        <h1>Welcome to PrepPilot AI</h1>
        <p>
          Your AI-powered placement interview coach. Chat with the AI Coach
          to prepare for your placement success.
        </p>
      </section>

      <HealthStatus />

      <section className="card-grid">
        {features.map((feature) => (
          <Link to={feature.to} key={feature.to} className="feature-card">
            <span className="feature-icon">{feature.icon}</span>
            <h2>{feature.title}</h2>
            <p>{feature.description}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}

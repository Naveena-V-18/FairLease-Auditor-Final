import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

interface AuditEmailProps {
  userName: string;
  score: number;
  verdict: string;
  reportUrl: string;
}

export const AuditResultEmail = ({
  userName,
  score,
  verdict,
  reportUrl,
}: AuditEmailProps) => (
  <Html>
    <Head />
    <Preview>Your FairLease Audit Results are ready.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>FairLease Auditor Report</Heading>
        <Text style={text}>Hi {userName},</Text>
        <Text style={text}>
          Your lease agreement has been successfully audited by our AI engine. 
          Here is a quick summary of your results:
        </Text>
        <Section style={scoreSection}>
          <Text style={scoreLabel}>Fairness Score</Text>
          <Text style={scoreValue}>{score}%</Text>
          <Text style={verdictText}>Verdict: <strong>{verdict}</strong></Text>
        </Section>
        <Text style={text}>
          We have generated a detailed PDF report including predatory clause detection 
          and suggested negotiation scripts. The full report is attached to this email.
        </Text>
        <Section style={btnContainer}>
          <Link href={reportUrl} style={button}>
            View Audit History
          </Link>
        </Section>
        <Hr style={hr} />
        <Text style={footer}>
          FairLease Auditor — Empowering tenants through AI.
          Chennai, India.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default AuditResultEmail;

// --- Styles ---
const main = { backgroundColor: "#f6f9fc", fontFamily: 'HelveticaNeue,Helvetica,Arial,sans-serif' };
const container = { backgroundColor: "#ffffff", border: "1px solid #eee", margin: "0 auto", padding: "45px 0 48px" };
const h1 = { color: "#1f2937", fontSize: "24px", fontWeight: "bold", textAlign: "center" as const, margin: "30px 0" };
const text = { color: "#4b5563", fontSize: "16px", lineHeight: "24px", textAlign: "left" as const, padding: "0 40px" };
const scoreSection = { background: "#f9fafb", borderRadius: "8px", margin: "24px 40px", padding: "24px", textAlign: "center" as const };
const scoreLabel = { color: "#6b7280", fontSize: "14px", textTransform: "uppercase" as const, letterSpacing: "1px" };
const scoreValue = { color: "#2563eb", fontSize: "48px", fontWeight: "bold", margin: "10px 0" };
const verdictText = { color: "#374151", fontSize: "18px" };
const btnContainer = { textAlign: "center" as const, margin: "32px 0" };
const button = { backgroundColor: "#2563eb", borderRadius: "5px", color: "#fff", fontSize: "16px", fontWeight: "bold", textDecoration: "none", textAlign: "center" as const, display: "inline-block", padding: "12px 24px" };
const hr = { borderColor: "#e5e7eb", margin: "20px 0" };
const footer = { color: "#9ca3af", fontSize: "12px", textAlign: "center" as const };
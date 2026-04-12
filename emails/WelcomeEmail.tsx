import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
  Link,
  Section,
} from "@react-email/components";
import * as React from "react";

// Added baseUrl to the props interface
export const WelcomeEmail = ({ userName, baseUrl }: { userName: string; baseUrl: string }) => (
  <Html>
    <Head />
    <Preview>Welcome to FairLease Auditor!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Welcome to FairLease! 🏠</Heading>
        <Text style={text}>Hi {userName},</Text>
        <Text style={text}>
          Thank you for joining FairLease Auditor. You are now equipped with 
          AI-powered tools to protect yourself from unfair rental agreements.
        </Text>
        <Section style={btnContainer}>
          {/* Dynamically uses baseUrl so it works in production too */}
          <Link href={`${baseUrl}`} style={button}>
            Start Your First Audit
          </Link>
        </Section>
        <Text style={text}>
          If you have any questions, just reply to this email. We're here to help!
        </Text>
        <Text style={footer}>— The FairLease Team, Chennai</Text>
      </Container>
    </Body>
  </Html>
);

export default WelcomeEmail;

const main = { backgroundColor: "#ffffff", fontFamily: 'sans-serif' };
const container = { margin: "0 auto", padding: "20px 0 48px", width: "580px" };
const h1 = { color: "#1f2937", fontSize: "32px", fontWeight: "700", textAlign: "center" as const };
const text = { color: "#4b5563", fontSize: "16px", lineHeight: "26px" };
const btnContainer = { textAlign: "center" as const, margin: "32px 0" };
// Updated to a professional Indigo/Navy hex
const button = { backgroundColor: "#4f46e5", borderRadius: "8px", color: "#fff", fontSize: "16px", fontWeight: "600", textDecoration: "none", textAlign: "center" as const, display: "inline-block", padding: "12px 24px" };
const footer = { color: "#9ca3af", fontSize: "14px", marginTop: "48px" };
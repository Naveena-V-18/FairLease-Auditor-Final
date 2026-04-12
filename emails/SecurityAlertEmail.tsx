import {
  Body, Container, Head, Heading, 
  Hr, Html, Preview, Section, Text 
} from "@react-email/components";
import * as React from "react";

export const SecurityAlertEmail = () => (
  <Html>
    <Head />
    <Preview>Security Notification: Password Updated</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <div style={logoCircle}>🛡️</div>
        </Section>
        <Heading style={h1}>Security Update</Heading>
        <Section style={successBadge}>
            <span style={{fontSize: "32px"}}>✅</span>
        </Section>
        <Text style={text}>
          Your password for FairLease Auditor was successfully updated. 
        </Text>
        <Text style={{ ...text, fontWeight: "bold", color: "#10b981", marginTop: "12px" }}>
          If this was you, no further action is needed.
        </Text>
        <Text style={{ ...text, fontSize: "12px", marginTop: "24px", color: "#94a3b8" }}>
          If you did NOT make this change, please contact support immediately to secure your vault.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          FairLease Auditor • Security Operations • Chennai, India
        </Text>
      </Container>
    </Body>
  </Html>
);

const main = { backgroundColor: "#f8fafc", fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif' };
const container = { margin: "0 auto", padding: "40px 20px", width: "465px", backgroundColor: "#ffffff", borderRadius: "24px", border: "1px solid #e2e8f0", marginTop: "40px" };
const logoSection = { textAlign: "center" as const };
const successBadge = { textAlign: "center" as const, marginBottom: "20px" };
const logoCircle = { width: "48px", height: "48px", backgroundColor: "#4f46e5", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", margin: "0 auto 24px" };
const h1 = { color: "#0f172a", fontSize: "24px", fontWeight: "800", textAlign: "center" as const, margin: "30px 0" };
const text = { color: "#475569", fontSize: "14px", lineHeight: "24px", textAlign: "center" as const };
const hr = { borderColor: "#f1f5f9", margin: "40px 0" };
const footer = { color: "#94a3b8", fontSize: "10px", textAlign: "center" as const, textTransform: "uppercase" as const, letterSpacing: "1px" };
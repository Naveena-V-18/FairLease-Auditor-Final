import {
  Body, Button, Container, Head, Heading, 
  Hr, Html, Preview, Section, Text 
} from "@react-email/components";
import * as React from "react";

export const ResetPasswordEmail = ({ resetLink }: { resetLink: string }) => (
  <Html>
    <Head />
    <Preview>Securely reset your FairLease Vault password.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <div style={logoCircle}>🛡️</div>
        </Section>
        <Heading style={h1}>Reset your Security Key</Heading>
        <Text style={text}>
          We received a request to access your FairLease Auditor account. To proceed with setting a new password, please click the secure button below:
        </Text>
        <Section style={btnContainer}>
          <Button style={button} href={resetLink}>
            Reset Password
          </Button>
        </Section>
        <Text style={text}>
          This link will expire in 24 hours. If you did not request this, you can safely ignore this email; your account remains secure.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          FairLease Auditor • LegalTech Solutions • Chennai, India
        </Text>
      </Container>
    </Body>
  </Html>
);

const main = { backgroundColor: "#f8fafc", fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif' };
const container = { margin: "0 auto", padding: "40px 20px", width: "465px", backgroundColor: "#ffffff", borderRadius: "24px", border: "1px solid #e2e8f0", marginTop: "40px" };
const logoSection = { textAlign: "center" as const };
const logoCircle = { width: "48px", height: "48px", backgroundColor: "#4f46e5", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", margin: "0 auto 24px" };
const h1 = { color: "#0f172a", fontSize: "24px", fontWeight: "800", textAlign: "center" as const, margin: "30px 0" };
const text = { color: "#475569", fontSize: "14px", lineHeight: "24px", textAlign: "center" as const };
const btnContainer = { textAlign: "center" as const, margin: "32px 0" };
const button = { backgroundColor: "#4f46e5", borderRadius: "12px", color: "#fff", fontSize: "14px", fontWeight: "bold", textDecoration: "none", textAlign: "center" as const, display: "block", padding: "14px 24px" };
const hr = { borderColor: "#f1f5f9", margin: "40px 0" };
const footer = { color: "#94a3b8", fontSize: "10px", textAlign: "center" as const, textTransform: "uppercase" as const, letterSpacing: "1px" };
import { Resend } from "resend";

let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

const FROM_EMAIL = process.env.FROM_EMAIL || "notifications@opensourcehunter.dev";

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailOptions) {
  const resend = getResendClient();
  if (!resend) {
    console.warn("RESEND_API_KEY not set, skipping email");
    return null;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });

    if (error) {
      console.error("Failed to send email:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Email send error:", error);
    return null;
  }
}

export function newIssueEmailTemplate(
  owner: string,
  repo: string,
  issueNumber: number,
  issueTitle: string,
  issueUrl: string
) {
  return {
    subject: `New issue in ${owner}/${repo}: #${issueNumber}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #24292f;">New Issue Detected</h2>
        <p>A new issue matching your filters was found:</p>
        <div style="background: #f6f8fa; border-radius: 6px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0 0 8px 0; font-weight: 600;">
            <a href="${issueUrl}" style="color: #0969da; text-decoration: none;">
              ${owner}/${repo}#${issueNumber}
            </a>
          </p>
          <p style="margin: 0; color: #24292f;">${issueTitle}</p>
        </div>
        <p>
          <a href="${issueUrl}" style="display: inline-block; background: #2da44e; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">
            View Issue
          </a>
        </p>
        <hr style="border: none; border-top: 1px solid #d0d7de; margin: 24px 0;" />
        <p style="color: #656d76; font-size: 12px;">
          You received this email because you have email notifications enabled for watched repositories.
          <a href="${process.env.NEXTAUTH_URL}/dashboard/settings" style="color: #0969da;">Manage preferences</a>
        </p>
      </div>
    `,
  };
}

export function draftReadyEmailTemplate(
  owner: string,
  repo: string,
  issueNumber: number,
  prNumber: number,
  draftUrl: string
) {
  return {
    subject: `Draft PR #${prNumber} ready for review: ${owner}/${repo}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #24292f;">Draft PR Ready for Review</h2>
        <p>A draft pull request has been generated for your tracked issue:</p>
        <div style="background: #f6f8fa; border-radius: 6px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0 0 8px 0; font-weight: 600; color: #24292f;">
            ${owner}/${repo}
          </p>
          <p style="margin: 0 0 4px 0; color: #656d76;">Issue #${issueNumber}</p>
          <p style="margin: 0; color: #8250df; font-weight: 500;">Draft PR #${prNumber}</p>
        </div>
        <p>
          <a href="${draftUrl}" style="display: inline-block; background: #8250df; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none;">
            Review Draft
          </a>
        </p>
        <hr style="border: none; border-top: 1px solid #d0d7de; margin: 24px 0;" />
        <p style="color: #656d76; font-size: 12px;">
          You received this email because you have email notifications enabled.
          <a href="${process.env.NEXTAUTH_URL}/dashboard/settings" style="color: #0969da;">Manage preferences</a>
        </p>
      </div>
    `,
  };
}

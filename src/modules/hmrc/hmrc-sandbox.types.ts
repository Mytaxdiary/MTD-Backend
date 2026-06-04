/** HMRC POST /create-test-user/agents — sandbox response */
export interface HmrcSandboxAgentUser {
  userId: string;
  password: string;
  userFullName: string;
  emailAddress: string;
  groupIdentifier: string;
  agentServicesAccountNumber: string;
  agentCode: string;
}

export interface HmrcSandboxIndividualAddress {
  line1?: string;
  line2?: string;
  postcode?: string;
}

export interface HmrcSandboxIndividualDetails {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  address?: HmrcSandboxIndividualAddress;
}

/** Raw HMRC POST /create-test-user/individuals — postcode may be nested under address */
export interface HmrcSandboxIndividualRaw {
  userId: string;
  password: string;
  userFullName: string;
  emailAddress: string;
  groupIdentifier?: string;
  nino: string;
  mtdItId?: string;
  postcode?: string;
  individualDetails?: HmrcSandboxIndividualDetails;
}

/** Normalised for the app — postcode always at top level */
export interface HmrcSandboxIndividualUser extends Omit<HmrcSandboxIndividualRaw, 'postcode'> {
  postcode: string;
}

export interface SandboxTestUsersResult {
  agent: HmrcSandboxAgentUser;
  individual: HmrcSandboxIndividualUser;
  nextSteps: string[];
}

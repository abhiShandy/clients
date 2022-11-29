import { OrganizationDomainResponse } from "../../models/response/organization-domain.response";

export class OrgDomainApiServiceAbstraction {
  getByOrgId: (orgId: string) => Promise<OrganizationDomainResponse>;
  getByOrgIdAndOrgDomainId: (
    orgId: string,
    orgDomainId: string
  ) => Promise<OrganizationDomainResponse>;
  post: (orgId: string, orgDomain: OrganizationDomainResponse) => Promise<any>;
  verify: (orgId: string, orgDomainId: string) => Promise<boolean>;
  delete: (orgId: string, orgDomainId: string) => Promise<any>;
}

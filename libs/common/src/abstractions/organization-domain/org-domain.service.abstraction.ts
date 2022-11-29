import { Observable } from "rxjs";

import { OrganizationDomainResponse } from "../../models/response/organization-domain.response";

export abstract class OrgDomainReadServiceAbstraction {
  orgDomains$: Observable<OrganizationDomainResponse[]>;

  get: (orgDomainId: string) => Promise<OrganizationDomainResponse>;
}

// Note: this separate class is designed to hold methods that are not
// meant to be used in components (e.g., data write methods)
export abstract class OrgDomainFullServiceAbstraction extends OrgDomainReadServiceAbstraction {
  upsert: (orgDomains: OrganizationDomainResponse[]) => void;
  replace: (orgDomains: OrganizationDomainResponse[]) => void;
  clearCache: () => Promise<void>;
  delete: (orgDomainIds: string[]) => void;
}

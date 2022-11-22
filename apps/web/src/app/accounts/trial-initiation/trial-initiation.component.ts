import { StepperSelectionEvent } from "@angular/cdk/stepper";
import { TitleCasePipe } from "@angular/common";
import { Component, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { UntypedFormBuilder, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { first, Subject, takeUntil } from "rxjs";

import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/abstractions/log.service";
import { PolicyApiServiceAbstraction } from "@bitwarden/common/abstractions/policy/policy-api.service.abstraction";
import { PolicyService } from "@bitwarden/common/abstractions/policy/policy.service.abstraction";
import { StateService } from "@bitwarden/common/abstractions/state.service";
import { PlanType } from "@bitwarden/common/enums/planType";
import { ProductType } from "@bitwarden/common/enums/productType";
import { PolicyData } from "@bitwarden/common/models/data/policy.data";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/models/domain/master-password-policy-options";
import { Policy } from "@bitwarden/common/models/domain/policy";
import { ReferenceEventRequest } from "@bitwarden/common/models/request/reference-event.request";

import { RouterService } from "./../../core/router.service";
import { VerticalStepperComponent } from "./vertical-stepper/vertical-stepper.component";

enum ValidOrgParams {
  families = "families",
  enterprise = "enterprise",
  teams = "teams",
  individual = "individual",
  premium = "premium",
  free = "free",
}

@Component({
  selector: "app-trial",
  templateUrl: "trial-initiation.component.html",
})
export class TrialInitiationComponent implements OnInit, OnDestroy {
  email = "";
  org = "";
  orgInfoSubLabel = "";
  orgId = "";
  orgLabel = "";
  billingSubLabel = "";
  layout = "default";
  plan: PlanType;
  product: ProductType;
  accountCreateOnly = true;
  useTrialStepper = false;
  policies: Policy[];
  enforcedPolicyOptions: MasterPasswordPolicyOptions;
  trialFlowOrgs: string[] = [
    ValidOrgParams.teams,
    ValidOrgParams.enterprise,
    ValidOrgParams.families,
  ];
  routeFlowOrgs: string[] = [
    ValidOrgParams.free,
    ValidOrgParams.premium,
    ValidOrgParams.individual,
  ];
  validLayouts: string[] = [
    "default",
    "teams",
    "teams1",
    "teams2",
    "enterprise",
    "enterprise1",
    "enterprise2",
    "cnetcmpgnent",
    "cnetcmpgnind",
    "cnetcmpgnteams",
    "abmenterprise",
    "abmteams",
  ];
  referenceData: ReferenceEventRequest;
  @ViewChild("stepper", { static: false }) verticalStepper: VerticalStepperComponent;

  orgInfoFormGroup = this.formBuilder.group({
    name: ["", [Validators.required]],
    email: [""],
  });

  private set referenceDataId(referenceId: string) {
    if (referenceId != null) {
      this.referenceData.id = referenceId;
    } else {
      this.referenceData.id = ("; " + document.cookie)
        .split("; reference=")
        .pop()
        .split(";")
        .shift();
    }

    if (this.referenceData.id === "") {
      this.referenceData.id = null;
    }
  }

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    protected router: Router,
    private formBuilder: UntypedFormBuilder,
    private titleCasePipe: TitleCasePipe,
    private stateService: StateService,
    private logService: LogService,
    private policyApiService: PolicyApiServiceAbstraction,
    private policyService: PolicyService,
    private i18nService: I18nService,
    private routerService: RouterService
  ) {}

  async ngOnInit(): Promise<void> {
    // eslint-disable-next-line rxjs-angular/prefer-takeuntil
    this.route.queryParams.pipe(first()).subscribe((qParams) => {
      this.referenceData = new ReferenceEventRequest();
      if (qParams.email != null && qParams.email.indexOf("@") > -1) {
        this.email = qParams.email;
      }

      this.referenceDataId = qParams.reference;

      if (this.validLayouts.includes(qParams.layout)) {
        this.layout = qParams.layout;
        this.accountCreateOnly = false;
      }

      if (this.trialFlowOrgs.includes(qParams.org)) {
        this.org = qParams.org;
        this.orgLabel = this.titleCasePipe.transform(this.org);
        this.useTrialStepper = true;
        this.referenceData.flow = qParams.org;

        if (this.org === ValidOrgParams.families) {
          this.plan = PlanType.FamiliesAnnually;
          this.product = ProductType.Families;
        } else if (this.org === ValidOrgParams.teams) {
          this.plan = PlanType.TeamsAnnually;
          this.product = ProductType.Teams;
        } else if (this.org === ValidOrgParams.enterprise) {
          this.plan = PlanType.EnterpriseAnnually;
          this.product = ProductType.Enterprise;
        }
      } else if (this.routeFlowOrgs.includes(qParams.org)) {
        this.referenceData.flow = qParams.org;
        const route = this.router.createUrlTree(["create-organization"], {
          queryParams: { plan: qParams.org },
        });
        this.routerService.setPreviousUrl(route.toString());
      }

      // Are they coming from an email for sponsoring a families organization
      // After logging in redirect them to setup the families sponsorship
      this.setupFamilySponsorship(qParams.sponsorshipToken);
    });

    const invite = await this.stateService.getOrganizationInvitation();
    if (invite != null) {
      try {
        const policies = await this.policyApiService.getPoliciesByToken(
          invite.organizationId,
          invite.token,
          invite.email,
          invite.organizationUserId
        );
        if (policies.data != null) {
          const policiesData = policies.data.map((p) => new PolicyData(p));
          this.policies = policiesData.map((p) => new Policy(p));
        }
      } catch (e) {
        this.logService.error(e);
      }
    }

    if (this.policies != null) {
      this.policyService
        .masterPasswordPolicyOptions$(this.policies)
        .pipe(takeUntil(this.destroy$))
        .subscribe((enforcedPasswordPolicyOptions) => {
          this.enforcedPolicyOptions = enforcedPasswordPolicyOptions;
        });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  stepSelectionChange(event: StepperSelectionEvent) {
    // Set org info sub label
    if (event.selectedIndex === 1 && this.orgInfoFormGroup.controls.name.value === "") {
      this.orgInfoSubLabel =
        "Enter your " + this.titleCasePipe.transform(this.org) + " organization information";
    } else if (event.previouslySelectedIndex === 1) {
      this.orgInfoSubLabel = this.orgInfoFormGroup.controls.name.value;
    }

    //set billing sub label
    if (event.selectedIndex === 2) {
      this.billingSubLabel = this.i18nService.t("billingTrialSubLabel");
    }
  }

  createdAccount(email: string) {
    this.email = email;
    this.orgInfoFormGroup.get("email")?.setValue(email);
    this.verticalStepper.next();
  }

  billingSuccess(event: any) {
    this.orgId = event?.orgId;
    this.billingSubLabel = event?.subLabelText;
    this.verticalStepper.next();
  }

  navigateToOrgVault() {
    this.router.navigate(["organizations", this.orgId, "vault"]);
  }

  navigateToOrgInvite() {
    this.router.navigate(["organizations", this.orgId, "manage", "people"]);
  }

  previousStep() {
    this.verticalStepper.previous();
  }

  private setupFamilySponsorship(sponsorshipToken: string) {
    if (sponsorshipToken != null) {
      const route = this.router.createUrlTree(["setup/families-for-enterprise"], {
        queryParams: { plan: sponsorshipToken },
      });
      this.routerService.setPreviousUrl(route.toString());
    }
  }
}

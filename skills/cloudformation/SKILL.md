---
name: cloudformation
description: Author, validate, and deploy AWS CloudFormation templates using this repo's IaC conventions — ProjectPrefix/Environment parameters, the cloudformation/ folder layout, provision.sh deployment, and cfn-lint validation. Use when asked to create, review, or deploy CloudFormation templates, set up an AWS IaC folder, or write a provisioning script for CFN stacks.
---

# CloudFormation

## Required parameters

Every template accepts these two parameters, even if a given stack doesn't strictly need both:

```yaml
Parameters:
  ProjectPrefix:
    Type: String
    Description: Domain/project prefix (e.g. ecommerce, store, auth)
    AllowedPattern: "^[a-z0-9-]+$"
    ConstraintDescription: Must contain only lowercase letters, numbers, and hyphens

  Environment:
    Type: String
    AllowedValues: [dev, int, stage, prod]
    Description: Target environment
```

Use them to name and scope resources predictably rather than hardcoding names:

```yaml
BucketName: !Sub "${ProjectPrefix}-${Environment}-assets"
```

## Folder layout

```
cloudformation/
  network.yml
  database.yml
  api.yml
provision.sh
```

- All templates live in `cloudformation/`, one stack concern per file.
- `provision.sh` sits adjacent to the folder (not inside it) and is the only sanctioned way to deploy — don't run `aws cloudformation deploy` by hand against a tracked template.

## Cross-stack outputs

When one template produces a value another needs, export it as a CloudFormation `Output` and mirror it to SSM Parameter Store — don't invent a bespoke config-sharing mechanism per stack.

```yaml
Resources:
  ThingIdParameter:
    Type: AWS::SSM::Parameter
    Properties:
      Name: !Sub "/${ProjectPrefix}/${Environment}/ThingId"
      Type: String
      Value: !Ref Thing

Outputs:
  ThingId:
    Description: ID of the thing other stacks depend on
    Value: !Ref Thing
    Export:
      Name: !Sub "${ProjectPrefix}-${Environment}-ThingId"

  ThingIdParameterName:
    Description: SSM Parameter name mirroring ThingId
    Value: !Ref ThingIdParameter
```

Consumers within the same account/region resolve the export directly:

```yaml
SomeProperty: !ImportValue
  Fn::Sub: "${ProjectPrefix}-${Environment}-ThingId"
```

Consumers outside CloudFormation (deploy scripts, Lambdas) or across an account/region boundary where `!ImportValue` can't reach read the SSM mirror instead:

```bash
aws ssm get-parameter --name "/${PROJECT_PREFIX}/${ENVIRONMENT}/ThingId" --query "Parameter.Value" --output text
```

Before deploying a stack that imports another stack's export, guard the lookup in `provision.sh` rather than letting `!ImportValue` fail with a cryptic CloudFormation error:

```bash
value=$(aws cloudformation list-exports \
  --query "Exports[?Name=='${PROJECT_PREFIX}-${ENVIRONMENT}-ThingId'].Value" \
  --output text)

if [[ -z "$value" || "$value" == "None" ]]; then
  echo "Deploy the producing stack first: provision.sh --thing" >&2
  exit 1
fi
```

Some outputs deliberately aren't auto-wired — e.g. an ID that a human must hand-carry into an application manifest or config file consumed outside IaC entirely. Print those clearly at the end of the deploy step rather than silently expecting the operator to know to go look.

## provision.sh contract

Give each deployable stack its own boolean flag rather than a generic `<template-name>` positional — stacks in a folder are rarely interchangeable enough for one argument shape, and named flags document what's deployable directly in `--help`. Reserve a positional/`--all` shape for a folder of genuinely homogeneous, safe-to-batch stacks.

```bash
./provision.sh --environment <env> --<stack-flag> [--<stack-flag> ...]
```

- `--environment` (`-e`) is required and validated against an explicit allow-list (e.g. `int`, `stage`, `prod`, plus any account-level aliases you use); default to the least-risky environment, never `prod`.
- Each stack gets its own flag (e.g. `--network`, `--database`, `--api`). Running with zero stack flags fails with a usage message — it never silently no-ops.
- `ProjectPrefix` is usually hardcoded per deploy function rather than accepted as a flag — a given `provision.sh` typically belongs to one project already, so there's rarely a need to parameterize it at the CLI.
- Guard cross-stack dependencies with an export lookup and a clear error before deploying (see Cross-stack outputs above) — don't let a missing dependency surface as a raw CloudFormation failure.
- Run `cfn-lint` against the target template(s) before invoking `aws cloudformation deploy` — fail closed on lint errors.

## Validation — cfn-lint

Every template must pass `cfn-lint` before being considered done:

```bash
cfn-lint cloudformation/*.yml
```

Install with `pip install cfn-lint` (or `brew install cfn-lint`).

Treat these as blocking, not advisory:

- Broad IAM `Resource: "*"` — scope to a specific ARN, or use `!Ref`/`!GetAtt` for dynamic references.
- Hardcoded ARNs — replace with `!Ref`, `!GetAtt`, or `Fn::ImportValue`.
- Hardcoded 12-digit account IDs — replace with `!Sub '${AWS::AccountId}'`.
- Missing `DeletionPolicy` (`Retain` or `Snapshot`) on stateful resources (S3 buckets, RDS instances, DynamoDB tables) that shouldn't be destroyed on stack deletion.

## Workflow

1. Determine whether the change is a new stack (new file in `cloudformation/`) or an edit to an existing one.
2. Author or edit the template with the `ProjectPrefix`/`Environment` parameters and `!Sub`-based resource naming.
3. Run `cfn-lint` against the changed template(s) and fix all findings.
4. Deploy via `provision.sh --environment <env> --<stack-flag>`, passing every flag for the stacks that changed; deploy producers before their consumers.
5. Confirm stack status (`aws cloudformation describe-stacks --stack-name <name>`) before considering the task complete.

## Keep it low-fat

Prefer intrinsic functions (`!Sub`, `!Ref`, `!GetAtt`, `Fn::ImportValue`) over Lambda-backed custom resources unless the behaviour genuinely can't be expressed declaratively. Don't introduce nested stacks or cross-stack exports for a single-template concern — only split stacks along real deployment or lifecycle boundaries (e.g. network vs. compute vs. data).

"""Command-line interface for LLM Eval Harness."""

import sys
import json
import click
from datetime import datetime
from pathlib import Path

from .config import get_settings
from .runner import EvalRunner


@click.group()
def cli():
    """LLM Evaluation Harness - Test and prevent LLM regressions."""
    pass


@cli.command()
@click.option(
    "--suite", "-s",
    required=True,
    type=click.Path(exists=True),
    help="Path to evaluation suite JSON file"
)
@click.option(
    "--out", "-o",
    type=click.Path(),
    help="Output path for results (default: ./runs/run_<timestamp>.json)"
)
@click.option(
    "--model", "-m",
    default=None,
    help="Model to use for evaluation (default from env)"
)
@click.option(
    "--fail-on-regression",
    is_flag=True,
    help="Exit with code 1 if regression detected"
)
def run(suite: str, out: str, model: str, fail_on_regression: bool):
    """Run an evaluation suite."""
    click.echo(f"Loading suite: {suite}")
    
    runner = EvalRunner(model=model)
    eval_suite = runner.load_suite(suite)
    
    click.echo(f"Running {len(eval_suite.test_cases)} test cases...")
    click.echo(f"Model: {runner.model}")
    click.echo()
    
    result = runner.run_suite(eval_suite)
    
    # Display results
    click.echo("=" * 60)
    click.echo(f"Suite: {result.suite_name}")
    click.echo(f"Duration: {result.duration_seconds:.2f}s")
    click.echo()
    
    for test_result in result.test_results:
        status = click.style("✓ PASS", fg="green") if test_result.passed else click.style("✗ FAIL", fg="red")
        click.echo(f"{status} {test_result.test_case_name}")
        
        if not test_result.passed:
            for metric in test_result.metrics:
                if not metric.passed:
                    click.echo(f"      └─ {metric.metric.value}: {metric.details}")
        
        if test_result.error:
            click.echo(f"      └─ Error: {test_result.error}")
    
    click.echo()
    click.echo("=" * 60)
    click.echo(f"Total: {result.total_tests} | Passed: {result.passed_tests} | Failed: {result.failed_tests}")
    click.echo(f"Pass Rate: {result.pass_rate:.1%}")
    
    if result.regression_detected:
        click.secho("⚠ REGRESSION DETECTED", fg="yellow", bold=True)
    
    click.echo(f"\nResults saved to: {runner.settings.runs_directory}/{result.id}.json")
    
    # Handle output file option
    if out:
        out_path = Path(out)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        with open(out_path, "w") as f:
            f.write(result.model_dump_json(indent=2))
        click.echo(f"Also saved to: {out}")
    
    # Exit with error if regression detected and flag is set
    if fail_on_regression and result.regression_detected:
        sys.exit(1)


@cli.command()
def latest():
    """Show the latest run result."""
    runner = EvalRunner()
    result = runner.get_latest_run()
    
    if not result:
        click.echo("No runs found.")
        return
    
    click.echo(json.dumps(result.model_dump(), indent=2, default=str))


@cli.command()
@click.argument("run_id")
def show(run_id: str):
    """Show a specific run result by ID."""
    runner = EvalRunner()
    result = runner.get_run(run_id)
    
    if not result:
        click.echo(f"Run not found: {run_id}")
        sys.exit(1)
    
    click.echo(json.dumps(result.model_dump(), indent=2, default=str))


@cli.command(name="list")
def list_runs():
    """List all evaluation runs."""
    runner = EvalRunner()
    summaries = runner.list_runs()
    
    if not summaries:
        click.echo("No runs found.")
        return
    
    click.echo(f"{'ID':<45} {'Suite':<20} {'Pass Rate':<10} {'Regression'}")
    click.echo("-" * 90)
    
    for summary in summaries:
        regression = "⚠" if summary.regression_detected else ""
        click.echo(f"{summary.id:<45} {summary.suite_name:<20} {summary.pass_rate:.1%}      {regression}")


if __name__ == "__main__":
    cli()
